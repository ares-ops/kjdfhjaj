import React, { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, getMint, getTransferFeeConfig, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
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

function Unstake() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const provider = new AnchorProvider(connection, wallet, "processed");
  const [yourRewards, setYourRewards] = useState(0);
  const [yourStaked, setYourStaked] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [calculatedAmountAfterTax, setCalculatedAmountAfterTax] = useState(0);
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

  const getConfigKeys = () => {
    if (program == null) {
      return;
    }

    const [configPda, configPdaBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(configPdaSeed)],
      program.programId
    );

    const [configAta, configAtaBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(configAtaSeed)],
      program.programId
    );

    return {
      configPda,
      configPdaBump,
      configAta,
      configAtaBump,
    };
  };

  const getUserAssociatedTokenAccountPublicKey = () => {
    return getAssociatedTokenAddressSync(new anchor.web3.PublicKey(tokenMint), wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
  };

  useEffect(() => {
    if (wallet.connected && program) {
      fetchUserStake();
    }
  }, [wallet.connected]);

  const fetchConfig = async () => {
    const configKeys = getConfigKeys();

    const config = await program.account.config.fetch(configKeys.configPda);

    return config;
  };

  const fetchUserStake = async () => {
    try {
      const userStakeKeys = getUserStakeKeys(wallet.publicKey);

      const userStakeAccount = await program.account.userStakeAccount.fetch(userStakeKeys.userStakePda);

      const totalStakedAmount = userStakeAccount.stakes.reduce((total, stake) => {
        return total + stake.amount.toNumber();
      }, 0);

      const config = await fetchConfig();

      setYourStaked(lamportsToSol(totalStakedAmount));

      // Start the auto calculation of rewards
      startRewardsCalculation(userStakeAccount, config);
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

  const startRewardsCalculation = (userStakeAccount, config) => {
    const annualRate = 0.15; // APY of 15%
    const secondsInYear = 365.0 * 24.0 * 3600.0;
    const secondRate = annualRate / secondsInYear; // Rate per second
    const minStakePeriodSeconds = config.minStakePeriod.toNumber() * 86400;

    const calculateRewards = () => {
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
      let totalReward = 0.0;

      userStakeAccount.stakes.forEach((stake) => {
        const stakeTimestamp = stake.timestamp;
        const duration = currentTime - stakeTimestamp; // Duration in seconds

        if (duration >= minStakePeriodSeconds) {
          const rewardDuration = duration; // Duration in seconds
          totalReward += stake.amount.toNumber() * secondRate * rewardDuration;
        }
      });

      // Convert total_reward to base unit
      const totalRewardBase = lamportsToSol(totalReward);
      setYourRewards(totalRewardBase);
    };

    calculateRewards(); // Initial calculation
    const intervalId = setInterval(calculateRewards, 1000); // Recalculate every second

    return () => clearInterval(intervalId); // Clear interval on cleanup
  };

  const handleUnstake = async () => {
    setIsLoading(true);

    try {
      const userAssociatedTokenAccount = getUserAssociatedTokenAccountPublicKey();
      const configKeys = getConfigKeys();

      const tx = await program.methods
        .unstake(configKeys.configPdaBump)
        .accounts({
          user: wallet.publicKey,
          userAta: userAssociatedTokenAccount,
          tokenMint: new anchor.web3.PublicKey(tokenMint),
        })
        .rpc();
      console.log("Your transaction signature", tx);
      message.success("Unstaked successfully.");
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

    setIsLoading(false);
  };

  const calculateAmountAfterTax = () => {
    if (!transferFeeConfig) return 0;

    const olderMaximumFee = Number(transferFeeConfig.olderTransferFee.maximumFee);
    const newerMaximumFee = Number(transferFeeConfig.newerTransferFee.maximumFee);
    const newerEpoch = Number(transferFeeConfig.newerTransferFee.epoch);

    const maximumFee = currentEpoch < newerEpoch ? olderMaximumFee : newerMaximumFee;

    const unstakeAmount = solToLamports(yourStaked) + solToLamports(yourRewards);

    let fee = Math.floor(unstakeAmount * tokenTax + 99) / 100;

    if (fee > maximumFee) {
      fee = maximumFee;
    }

    return yourStaked + yourRewards - lamportsToSol(fee);
  };

  useEffect(() => {
    if (transferFeeConfig && currentEpoch !== 0) {
      const amountAfterTax = calculateAmountAfterTax();
      setCalculatedAmountAfterTax(amountAfterTax);
    }
  }, [yourStaked, yourRewards, transferFeeConfig, currentEpoch]);

  return (
    <div className="flex flex-col items-center justify-center h-screen px-4">
      <div className="bg-purple-light rounded-lg p-6 w-full max-w-md mx-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Unstake</h2>
          <span className="text-sm text-blue-300 cursor-pointer">Advanced User Rewards</span>
        </div>
        <div className="mt-4 text-sm text-white">
          <p>Track and claim your rewards instantly! Our platform updates your earnings in real time at a 15% APY.</p>
        </div>
        <div className="mt-4">
          <div className="bg-purple-medium p-4 rounded-lg space-y-2">
            <span className="text-white">Your Rewards</span>
            <div className="text-3xl font-bold text-white">{yourRewards > 0 ? yourRewards.toFixed(8) : yourRewards}</div>
          </div>
          <div className="bg-purple-medium p-4 rounded-lg space-y-2 mt-4">
            <span className="text-white">Your Staked Amount</span>
            <div className="text-3xl font-bold text-white">{yourStaked > 0 ? yourStaked.toFixed(8) : yourStaked}</div>
          </div>
          <div className="bg-purple-medium p-4 rounded-lg space-y-2 mt-4">
            <span className="text-white">Total After Tax</span>
            <div className="text-3xl font-bold text-white">
              {calculatedAmountAfterTax > 0 ? calculatedAmountAfterTax.toFixed(8) : 0}{" "}
            </div>
            <div className="text-sm text-gray-300">
              {tokenTax}% transfer fee will be charged. After tax, you will receive{" "}
              {calculatedAmountAfterTax > 0 ? calculatedAmountAfterTax.toFixed(8) : 0}
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0">
            {isLoading ? (
              <Audio height="35" width="35" radius="9" color="yellow" ariaLabel="loading" wrapperStyle wrapperClass />
            ) : (
              <button className="bg-yellow-400 text-black px-6 py-2 rounded-lg w-full" onClick={handleUnstake}>
                UNSTAKE
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
        .text-gray-300 {
          color: #d1d5db;
        }
        .text-blue-300 {
          color: #63b3ed;
        }
      `}</style>
    </div>
  );
}

export default Unstake;
