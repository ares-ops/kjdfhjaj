import React, { useEffect, useState } from "react";
import { Table, Button } from "antd";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { CONFIG } from "../utils/config";
import idl from "../idl/idl.json";

const contractAddress = CONFIG.STAKING_CONTRACT_ADDRESS;
const tokenDecimals = CONFIG.TOKEN_DECIMALS;
const configPdaSeed = CONFIG.CONFIG_PDA_SEED;
const configAtaSeed = CONFIG.CONFIG_ATA_SEED;

const AdvancedRewardsView = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const provider = new AnchorProvider(connection, wallet, "processed");

  const [dataSource, setDataSource] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchDataTrigger, setFetchDataTrigger] = useState(false);

  const [prevPublicKey, setPrevPublicKey] = useState(null);

  useEffect(() => {
    console.log("called");
    if (wallet.publicKey && wallet.publicKey.toString() !== prevPublicKey) {
      const refreshData = () => {
        console.log("Wallet changed, refreshing data...");
      };

      refreshData();
      setPrevPublicKey(wallet.publicKey.toString());
    }
  }, [wallet.publicKey, prevPublicKey]);

  let program = null;
  if (wallet.connected && contractAddress) {
    program = new Program(idl, provider);
  }

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

  const fetchUserStakes = async () => {
    setLoading(true);
    try {
      const userStakeKeys = getUserStakeKeys(wallet.publicKey);
      const userStakeAccount = await program.account.userStakeAccount.fetch(userStakeKeys.userStakePda);

      const configKeys = await getConfigKeys();
      const config = await program.account.config.fetch(configKeys.configPda);

      const minStakePeriodSeconds = config.minStakePeriod.toNumber() * 86400;
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

      const dataSource = userStakeAccount.stakes.map((stake) => {
        const stakeTimestamp = stake.timestamp;
        const durationPassed = currentTime - stakeTimestamp;
        const isEligible = durationPassed >= minStakePeriodSeconds;

        const annualRate = 0.15; // APY of 15%
        const secondsInYear = 365.0 * 24.0 * 3600.0;
        const secondRate = annualRate / secondsInYear; // Rate per second
        const reward = isEligible ? stake.amount.toNumber() * secondRate * durationPassed : 0;

        return {
          key: stake.timestamp.toString(),
          address: wallet.publicKey.toString(),
          stakeAmount: lamportsToSol(stake.amount.toNumber()),
          stakeTimestamp: new Date(stake.timestamp * 1000).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }),
          minStakePeriod: `${config.minStakePeriod.toNumber()} days`,
          durationPassed: formatDuration(durationPassed),
          stakeReward: lamportsToSol(reward).toFixed(8),
          eligible: isEligible ? "Yes" : "No",
        };
      });

      setDataSource(dataSource);
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
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes} minutes ${remainingSeconds > 0 ? `${remainingSeconds} seconds` : ""}`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hours ${minutes > 0 ? `${minutes} minutes` : ""}`;
    } else {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days} days ${hours > 0 ? `${hours} hours` : ""} ${minutes > 0 ? `${minutes} minutes` : ""}`;
    }
  };

  useEffect(() => {
    if (wallet.connected && program) {
      fetchUserStakes();
    }
  }, [wallet.connected, fetchDataTrigger]);

  const handleUpdateStatus = async (record) => {
    try {
      // Update status logic here
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setLoading(false); // Set loading state back to false after update
    }
  };

  const columns = [
    {
      title: "User Address",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "Stake Amount (SOL)",
      dataIndex: "stakeAmount",
      key: "stakeAmount",
    },
    {
      title: "Stake Timestamp",
      dataIndex: "stakeTimestamp",
      key: "stakeTimestamp",
    },
    {
      title: "Minimum Stake Period",
      dataIndex: "minStakePeriod",
      key: "minStakePeriod",
    },
    {
      title: "Duration Passed",
      dataIndex: "durationPassed",
      key: "durationPassed",
    },
    {
      title: "Stake Reward (SOL)",
      dataIndex: "stakeReward",
      key: "stakeReward",
    },
    {
      title: "Eligible for Rewards",
      dataIndex: "eligible",
      key: "eligible",
    },
  ];

  return (
    <div style={{ padding: "20px", minHeight: "100vh" }}>
      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="key"
        size="middle"
        pagination={false}
        loading={loading}
        scroll={{ x: 800 }}
        style={{ width: "100%" }}
      />
    </div>
  );
};

export default AdvancedRewardsView;
