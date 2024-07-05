import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Token2022Staking } from "../target/types/token_2022_staking";
import * as dotenv from "dotenv";
import { getAccount, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assert, expect } from "chai";

dotenv.config();

// -------------------------------------------------------------------------------------------------
//                                GLOBAL VARIABLES
// -------------------------------------------------------------------------------------------------

const TOKEN_MINT = process.env.TOKEN_MINT;
const CONFIG_PDA_SEED = process.env.CONFIG_PDA_SEED;
const CONFIG_ATA_SEED = process.env.CONFIG_ATA_SEED;
const AUTHORITY_WALLET: number[] = JSON.parse(process.env.AUTHORITY_WALLET);

let CONFIG_PDA = { configPda: null, configPdaBump: null };
let CONFIG_ATA = { configAta: null, configAtaBump: null };

// -------------------------------------------------------------------------------------------------

describe("token-2022-staking", async () => {
  const provider = anchor.AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const program = anchor.workspace.Token2022Staking as Program<Token2022Staking>;

  // -------------------------------------------------------------------------------------------------
  //                                Setting Global Variables
  // -------------------------------------------------------------------------------------------------

  const TOKEN_MINT_PUBLIC_KEY = new anchor.web3.PublicKey(TOKEN_MINT);

  const authorityWallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(AUTHORITY_WALLET));
  const authorityPublicKey = authorityWallet.publicKey;

  [CONFIG_PDA.configPda, CONFIG_PDA.configPdaBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_PDA_SEED)],
    program.programId
  );

  [CONFIG_ATA.configAta, CONFIG_ATA.configAtaBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_ATA_SEED)],
    program.programId
  );

  const [userStakeAccountPda, userStakeAccountPdaBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [new anchor.web3.PublicKey("HEWbAoGrvmYerTHZ5vbv887DmsMiB58c4skiiE7P6kvo").toBuffer()],
    program.programId
  );

  const authorityAssociatedTokenAccount = getAssociatedTokenAddressSync(
    TOKEN_MINT_PUBLIC_KEY,
    authorityPublicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  // console.log({ B: TOKEN_MINT_PUBLIC_KEY.toBase58(), A: authorityAssociatedTokenAccount.toBase58() });

  // const configAtaAccount = await getAccount(provider.connection, CONFIG_ATA.configAta, "confirmed", TOKEN_2022_PROGRAM_ID);

  // console.log({
  //   ConfigPda: CONFIG_PDA.configPda.toBase58(),
  //   Address: configAtaAccount.address.toBase58(),
  //   mint: configAtaAccount.mint.toBase58(),
  //   owner: configAtaAccount.owner.toBase58(),
  //   amount: configAtaAccount.amount.toString(),
  // });

  // -------------------------------------------------------------------------------------------------
  //                                        TESTS
  // -------------------------------------------------------------------------------------------------

  it("Is initialized!", async () => {
    const minimumStakePeriod = 30;
    const tokenDecimals = 9;
    const taxPercentage = 3;

    const tx = await program.methods
      .initialize(new anchor.BN(minimumStakePeriod), tokenDecimals, taxPercentage)
      .accounts({
        authority: authorityPublicKey,
        tokenMint: authorityPublicKey,
      })
      .signers([authorityWallet])
      .rpc();
    console.log("Your transaction signature", tx);
  });

  // it("Reading Config Account", async () => {
  //   const config = await program.account.config.fetch(CONFIG_PDA.configPda);

  //   console.log("Config Account: ", {
  //     authority: config.authority.toBase58(),
  //     minStakePeriod: config.minStakePeriod.toNumber(),
  //   });
  // });

  // it("Update Staking Period", async () => {
  //   const tx = await program.methods
  //     .updateMinStakePeriod(new anchor.BN(60))
  //     .accounts({
  //       authority: authorityPublicKey,
  //     })
  //     .signers([authorityWallet])
  //     .rpc();
  //   console.log("Your transaction signature", tx);
  // });

  // it("Deposit Rewards", async () => {
  //   const tx = await program.methods
  //     .depositRewards(new anchor.BN(100 * Math.pow(10, 9)))
  //     .accounts({
  //       depositor: authorityPublicKey,
  //       depositorAta: authorityAssociatedTokenAccount,
  //       tokenMint: TOKEN_MINT_PUBLIC_KEY,
  //     })
  //     .signers([authorityWallet])
  //     .rpc();
  //   console.log("Your transaction signature", tx);
  // });

  // // it("Withdraw Rewards", async () => {
  // const tx = await program.methods
  //   .withdraw(CONFIG_PDA.configPdaBump)
  //   .accounts({
  //     authority: authorityPublicKey,
  //     authorityAta: authorityAssociatedTokenAccount,
  //     tokenMint: TOKEN_MINT_PUBLIC_KEY,
  //   })
  //   .signers([authorityWallet])
  //   .rpc();
  // //   console.log("Your transaction signature", tx);
  // // });

  // it("Stake", async () => {
  //   try {
  //     const userStakeAccount = await program.account.userStakeAccount.fetch(userStakeAccountPda);

  //     console.log(userStakeAccountPda);

  //     // Account Exists
  //     const tx = await program.methods
  //       .stakeReallocx(new anchor.BN(10 * Math.pow(10, 9)))
  //       .accounts({
  //         user: authorityPublicKey,
  //         userAta: authorityAssociatedTokenAccount,
  //         tokenMint: TOKEN_MINT_PUBLIC_KEY,
  //       })
  //       .signers([authorityWallet])
  //       .rpc();
  //     console.log("Your transaction signature", tx);
  //   } catch (error) {
  //     console.log(error);

  //     // Not Exists
  //     if (error.message && error.message.includes("Account does not exist")) {
  //       const tx = await program.methods
  //         .stake(new anchor.BN(10 * Math.pow(10, 9)))
  //         .accounts({
  //           user: authorityPublicKey,
  //           userAta: authorityAssociatedTokenAccount,
  //           tokenMint: TOKEN_MINT_PUBLIC_KEY,
  //         })
  //         .signers([authorityWallet])
  //         .rpc();
  //       console.log("Your transaction signature", tx);
  //     }
  //   }
  // });

  // it("Claim Rewards", async () => {
  //   try {
  //     const tx = await program.methods
  //       .claimRewards(CONFIG_PDA.configPdaBump)
  //       .accounts({
  //         user: authorityPublicKey,
  //         userAta: authorityAssociatedTokenAccount,
  //         tokenMint: TOKEN_MINT_PUBLIC_KEY,
  //       })
  //       .signers([authorityWallet])
  //       .rpc();
  //     console.log("Your transaction signature", tx);
  //   } catch (error) {
  //     console.log(error);
  //   }
  // });

  // it("Unstake", async () => {
  //   try {
  //     const tx = await program.methods
  //       .unstake(CONFIG_PDA.configPdaBump)
  //       .accounts({
  //         user: authorityPublicKey,
  //         userAta: authorityAssociatedTokenAccount,
  //         tokenMint: TOKEN_MINT_PUBLIC_KEY,
  //       })
  //       .signers([authorityWallet])
  //       .rpc();
  //     console.log("Your transaction signature", tx);
  //   } catch (error) {
  //     console.log(error);
  //   }
  // });

  it("Reading Stake Account", async () => {
    try {
      const userStakeAccount = await program.account.userStakeAccount.fetch(userStakeAccountPda);

      console.log("User Stake Account: ", {
        authority: userStakeAccount.authority.toBase58(),
        stakes: userStakeAccount.stakes.map((stake) => ({
          amount: stake.amount.toString(),
          timestamp: new Date(stake.timestamp.toNumber() * 1000).toLocaleString(), // converting UNIX timestamp to readable date
        })),
      });
    } catch (error) {
      console.log({ error });
    }
  });
});
