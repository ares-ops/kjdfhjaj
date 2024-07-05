import * as cron from "node-cron";
import {
  FEE_VAULT,
  NETWORK,
  SOLSCAN_CLUSTER,
  TOKEN_MINT,
  WITHDRAW_PERIOD,
} from "./config";
import { Connection, Keypair, LAMPORTS_PER_SOL, ParsedAccountData, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { decode } from "bs58";
import dotenv from 'dotenv';
dotenv.config();
const OWNER_PRIVATE_KEY: string = "5RrJSrUmBGeLVfNExxLb2swzuLuLqCBiURJ84yNyADTEDkAZEWayvmQUEMDhdVe6wAgVt3jJv9TL27EdbxAn8FPs"
//process.env.OWNER_PRIVATE_KEY || "";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getTransferFeeAmount,
  unpackAccount,
  withdrawWithheldTokensFromAccounts,
} from "@solana/spl-token";

let withdrew = false;

const networkUrl = clusterApiUrl(NETWORK);
console.log(networkUrl);
const connection = new Connection(networkUrl, "singleGossip");
const WALLET = Keypair.fromSecretKey(decode(OWNER_PRIVATE_KEY));
console.log("wallet address = ", WALLET.publicKey.toBase58());

const payer = WALLET;
const withdrawWithheldAuthority = WALLET;

// Helper function to generate Explorer URL
function generateExplorerTxUrl(txId: string) {
  return `https://solscan.io/tx/${txId}${SOLSCAN_CLUSTER}`;
}

type AccountsAmount = {
  accounts: PublicKey[]
  amount: bigint
}

const withdraw = async () => {
  let accountsAmount: AccountsAmount = {
    accounts: [],
    amount: BigInt(0)
  }
  try {
    // Step 6 - Fetch Fee Accounts
    const allAccounts = await connection.getProgramAccounts(
      TOKEN_2022_PROGRAM_ID,
      {
        commitment: "confirmed",
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: TOKEN_MINT.toString(),
            },
          },
        ],
      }
    );
    console.log("Withdraw allAccounts: ", allAccounts);
    const accountsToWithdrawFrom: PublicKey[] = [];
    let amount: bigint = BigInt("0");
    for (const accountInfo of allAccounts) {
      const account = unpackAccount(
        accountInfo.pubkey,
        accountInfo.account,
        TOKEN_2022_PROGRAM_ID
      );
      console.log("Withdraw accountInfo.pubkey: ", accountInfo.pubkey);
      const info = await connection.getParsedAccountInfo(TOKEN_MINT);
      let parsedAccountData: ParsedAccountData = info.value?.data as ParsedAccountData;
      // console.log("Withdraw info: ", parsedAccountData.parsed?.info.tokenAmount.uiAmount);
      console.log("Withdraw info: ", info.value?.data);

      // const balance = info.value.lamports / LAMPORTS_PER_SOL;
      const transferFeeAmount = getTransferFeeAmount(account);
      if (
        transferFeeAmount !== null &&
        transferFeeAmount.withheldAmount > BigInt(0)
      ) {
        amount = amount + transferFeeAmount.withheldAmount;
        console.log({
            T: transferFeeAmount.withheldAmount,
            amount
        })
        accountsToWithdrawFrom.push(accountInfo.pubkey);
      }
    }
    accountsAmount = {
      accounts: accountsToWithdrawFrom,
      amount
    }
    // console.log("Withdraw accountsToWithdrawFrom: ", accountsToWithdrawFrom);
    // Step 7 - Withdraw Fees by Authority
    const feeVaultAccount = await createAssociatedTokenAccountIdempotent(
      connection,
      payer,
      TOKEN_MINT,
      FEE_VAULT,
      {},
      TOKEN_2022_PROGRAM_ID
    );
    console.log("Withdraw feeVaultAccount: ", feeVaultAccount);
    const withdrawSig1 = await withdrawWithheldTokensFromAccounts(
      connection,
      payer,
      TOKEN_MINT,
      feeVaultAccount,
      withdrawWithheldAuthority,
      [],
      accountsAmount.accounts,
      {},
      TOKEN_2022_PROGRAM_ID
    );
    console.log("Withdraw from Accounts:", generateExplorerTxUrl(withdrawSig1));

    withdrew = true;
  } catch (error) {
    console.log("error", error);
  }
};

const main = async () => {
  // cron.schedule(`*/${WITHDRAW_PERIOD} * * * * *`, async () => {
    console.log(`running a task every ${WITHDRAW_PERIOD} seconds`);

    // while (!withdrew) {
      await withdraw();
    // }

    // withdrew = false;
  // });
};

main();
