import React, { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
  ExtensionType,
  getAssociatedTokenAddressSync,
  getExtensionTypes,
  getMint,
  getTransferFeeConfig,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Audio } from "react-loader-spinner";
import { message } from "antd";
import idl from "../idl/idl.json";
import { CONFIG } from "../utils/config";

const contractAddress = CONFIG.STAKING_CONTRACT_ADDRESS;
const tokenMint = CONFIG.TOKEN_MINT_ADDRESS;
const tokenDecimals = CONFIG.TOKEN_DECIMALS;
const tokenTax = CONFIG.TOKEN_TAX;
const configPdaSeed = CONFIG.CONFIG_PDA_SEED;
const configAtaSeed = CONFIG.CONFIG_ATA_SEED;

const Stake = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const provider = new AnchorProvider(connection, wallet, "processed");

  const [yourStaked, setYourStaked] = useState(0);
  const [stakeAmount, setStakeAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [calculatedAmountAfterTax, setCalculatedAmountAfterTax] = useState(0);
  const [maxFee, setMaxFee] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [transferFeeConfig, setTransferFeeConfig] = useState(null);

  const [prevPublicKey, setPrevPublicKey] = useState(null);

  const fetchData = async () => {
    try {
      const mint = await getMint(connection, new anchor.web3.PublicKey(tokenMint), "confirmed", TOKEN_2022_PROGRAM_ID);
      const transferFeeConfig = getTransferFeeConfig(mint);
      const clock = await connection.getEpochInfo();
      setTransferFeeConfig(transferFeeConfig);
      setCurrentEpoch(clock.epoch);
    } catch (error) {
      console.log(error);
      message.error("Failed to fetch necessary data.");
    }
  };

  useEffect(() => {
    if (wallet.publicKey && wallet.publicKey.toString() !== prevPublicKey) {
      const refreshData = () => {
        console.log("Wallet changed, refreshing data...");
        fetchData();
      };

      refreshData();
      setPrevPublicKey(wallet.publicKey.toString());
    }
  }, [wallet.publicKey, prevPublicKey]);

  let program = null;

  if (wallet.connected && contractAddress) {
    program = new Program(idl, provider);
  }

  const getUserStakeKeys = (userWalletAddress) => {
    if (program == null) {
      return;
    }

    const [userStakePda, userStakePdaBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [userWalletAddress.toBuffer()],
      program.programId
    );

    return {
      userStakePda,
      userStakePdaBump,
    };
  };

  const lamportsToSol = (lamports) => {
    const conversionFactor = Math.pow(10, tokenDecimals);
    return lamports / conversionFactor;
  };

  const solToLamports = (sol) => {
    const conversionFactor = Math.pow(10, tokenDecimals);
    return sol * conversionFactor;
  };

  const getUserAssociatedTokenAccountPublicKey = () => {
    return getAssociatedTokenAddressSync(new anchor.web3.PublicKey(tokenMint), wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
  };

  useEffect(() => {
    if (wallet.connected && program) {
      fetchUserStake();
    }
  }, [wallet.connected]);

  const fetchUserStake = async () => {
    try {
      const userStakeKeys = getUserStakeKeys(wallet.publicKey);

      const userStakeAccount = await program.account.userStakeAccount.fetch(userStakeKeys.userStakePda);

      const totalStakedAmount = userStakeAccount.stakes.reduce((total, stake) => {
        return total + stake.amount.toNumber();
      }, 0);

      setYourStaked(lamportsToSol(totalStakedAmount));
    } catch (error) {
      if (error instanceof anchor.AnchorError) {
        const anchorError = error;
        console.error(`Error Code: ${anchorError.error.errorCode.code}`);
        console.error(`Error Number: ${anchorError.error.errorCode.number}`);
        console.error(`Error Message: ${anchorError.error.errorMessage}`);
        // message.error(anchorError.error.errorMessage);
      } else if (error instanceof Error) {
        // message.error("An Error Occured");
        console.error(`General Error: ${error.message}`);
      } else {
        // message.error("An Error Occured");
        console.error(`Unexpected Error: ${error}`);
      }
    }
  };

  const handleStake = async () => {
    setIsLoading(true);

    const userAssociatedTokenAccount = getUserAssociatedTokenAccountPublicKey();

    try {
      const userStakeKeys = getUserStakeKeys(wallet.publicKey);

      await program.account.userStakeAccount.fetch(userStakeKeys.userStakePda);

      // Account Exists
      const tx = await program.methods
        .stakeReallocx(new anchor.BN(solToLamports(stakeAmount)))
        .accounts({
          user: wallet.publicKey,
          userAta: userAssociatedTokenAccount,
          tokenMint: new anchor.web3.PublicKey(tokenMint),
        })
        .rpc();
      message.success("Stake transaction successful.");
      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error);

      // Account Does Not Exist
      if (error.message && error.message.includes("Account does not exist")) {
        try {
          const tx = await program.methods
            .stake(new anchor.BN(solToLamports(stakeAmount)))
            .accounts({
              user: wallet.publicKey,
              userAta: userAssociatedTokenAccount,
              tokenMint: new anchor.web3.PublicKey(tokenMint),
            })
            .rpc();
          message.success("Stake transaction successful.");
          console.log("Your transaction signature", tx);
        } catch (error) {
          if (error instanceof anchor.AnchorError) {
            const anchorError = error;
            console.error(`Error Code: ${anchorError.error.errorCode.code}`);
            console.error(`Error Number: ${anchorError.error.errorCode.number}`);
            console.error(`Error Message: ${anchorError.error.errorMessage}`);
            message.error(anchorError.error.errorMessage);
          } else if (error instanceof Error) {
            message.error("An Error Occured");
            console.error(`General Error: ${error.message}`);
          } else {
            message.error("An Error Occured");
            console.error(`Unexpected Error: ${error}`);
          }
        }
      } else {
        if (error instanceof anchor.AnchorError) {
          const anchorError = error;
          console.error(`Error Code: ${anchorError.error.errorCode.code}`);
          console.error(`Error Number: ${anchorError.error.errorCode.number}`);
          console.error(`Error Message: ${anchorError.error.errorMessage}`);
          message.error(anchorError.error.errorMessage);
        } else if (error instanceof Error) {
          message.error("An Error Occured");
          console.error(`General Error: ${error.message}`);
        } else {
          message.error("An Error Occured");
          console.error(`Unexpected Error: ${error}`);
        }
      }
    }

    setIsLoading(false);
  };

  const calculateAmountAfterTax = () => {
    if (!transferFeeConfig) return 0;

    const stakeAmountInLamports = solToLamports(stakeAmount);

    const olderMaximumFee = Number(transferFeeConfig.olderTransferFee.maximumFee);
    const newerMaximumFee = Number(transferFeeConfig.newerTransferFee.maximumFee);
    const newerEpoch = Number(transferFeeConfig.newerTransferFee.epoch);

    // Get the current epoch from the Clock sysvar

    const maximumFee = currentEpoch < newerEpoch ? olderMaximumFee : newerMaximumFee;

    setMaxFee(lamportsToSol(maximumFee));

    let fee = Math.floor((stakeAmountInLamports * tokenTax + 99) / 100);
    console.log({ olderMaximumFee, newerMaximumFee, currentEpoch, newerEpoch, fee });

    if (fee > maximumFee) {
      fee = maximumFee;
    }

    return lamportsToSol(stakeAmountInLamports - fee);
  };

  useEffect(() => {
    if (transferFeeConfig && currentEpoch !== 0) {
      const amountAfterTax = calculateAmountAfterTax();
      console.log({ amountAfterTax });
      setCalculatedAmountAfterTax(amountAfterTax);
    }
  }, [stakeAmount, transferFeeConfig, currentEpoch]);

  return (
    <div className="flex flex-col items-center justify-center h-screen px-4">
      <div className="bg-purple-light rounded-lg p-6 w-full max-w-md mx-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Stake Pool</h2>
        </div>
        <div className="mt-4">
          <div className="bg-purple-medium p-4 rounded-lg">
            <div className="flex justify-between">
              <span>Your Staked</span>
            </div>
            <div className="text-3xl font-bold">{yourStaked} TOKENS</div>
          </div>
          <div className="mt-4">
            <label htmlFor="amount" className="block">
              AMOUNT TO STAKE
            </label>
            <div className="flex items-center mt-1">
              <input
                id="amount"
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="bg-purple-medium p-2 rounded-l-lg w-full"
              />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {tokenTax}% transfer fee will be charged. Your actual stake will be approx. {calculatedAmountAfterTax.toFixed(6)}{" "}
              TOKENS after tax.
              <br />
              The maximum fee is {maxFee} tokens.
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0">
            {isLoading ? (
              <Audio height="35" width="35" radius="9" color="yellow" ariaLabel="loading" wrapperStyle wrapperClass />
            ) : (
              <button className="bg-yellow-400 text-black px-6 py-2 rounded-lg w-full" onClick={handleStake}>
                STAKE
              </button>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .bg-purple-light {
          background-color: #6a0dad;
        }
        .bg-purple-medium {
          background-color: #8a2be2;
        }
        .text-gray-500 {
          color: #a0aec0;
        }
      `}</style>
    </div>
  );
};

export default Stake;
