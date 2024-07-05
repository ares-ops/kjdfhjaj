import React, { useEffect, useState } from "react";
import { Card, Form, Input, Button, Col, Row, message } from "antd";
import { CONFIG } from "../utils/config";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import idl from "../idl/idl.json";
import * as anchor from "@coral-xyz/anchor";
import { getAccount, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

let contractAddress = CONFIG.STAKING_CONTRACT_ADDRESS;
let tokenMint = CONFIG.TOKEN_MINT_ADDRESS;
let tokenDecimals = CONFIG.TOKEN_DECIMALS;
let tokenTax = CONFIG.TOKEN_TAX;
let configPdaSeed = CONFIG.CONFIG_PDA_SEED;
let configAtaSeed = CONFIG.CONFIG_ATA_SEED;

const AdminDashboard = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const provider = new AnchorProvider(connection, wallet, "processed");

  const [loadingInitialize, setLoadingInitialize] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingWithdraw, setLoadingWithdraw] = useState(false);

  const [minimumStakePeriod, setMinimumStakePeriod] = useState(null);
  const [rewardsBalance, setRewardsBalance] = useState(null);
  const [authorityAddress, setAuthorityAddress] = useState(null);

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
      fetchConfig();
      fetchRewardsBalance();
    }
  }, [wallet.connected]);

  const fetchConfig = async () => {
    try {
      const configKeys = getConfigKeys();

      const config = await program.account.config.fetch(configKeys.configPda);

      const _minimumStakePeriod = config.minStakePeriod.toNumber();
      const _authorityAddress = config.authority.toBase58();

      setAuthorityAddress(_authorityAddress);
      setMinimumStakePeriod(_minimumStakePeriod);
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

  const fetchRewardsBalance = async () => {
    try {
      const configKeys = getConfigKeys();

      const configAtaAccount = await getAccount(provider.connection, configKeys.configAta, "confirmed", TOKEN_2022_PROGRAM_ID);

      const _rewardsBalance = lamportsToSol(configAtaAccount.amount.toString());

      setRewardsBalance(_rewardsBalance);
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

  const handleInitializeContract = async (values) => {
    try {
      setLoadingInitialize(true);
      console.log("Initialize Contract with values:", values);

      const tx = await program.methods
        .initialize(new anchor.BN(values.minimumStakePeriod), values.decimals, values.tokenTax)
        .accounts({
          authority: wallet.publicKey,
          tokenMint: new anchor.web3.PublicKey(values.stakingTokenMintAddress),
        })
        .rpc();

      console.log("Your transaction signature", tx);
      message.success("Contract initialized successfully!. Your transaction id is " + tx);
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
    } finally {
      setLoadingInitialize(false);
    }
  };

  const handleUpdateMinimumStakePeriod = async (values) => {
    try {
      setLoadingUpdate(true);
      console.log("Update Minimum Stake Period with value:", values.minimumStakePeriod);

      const tx = await program.methods
        .updateMinStakePeriod(new anchor.BN(values.minimumStakePeriod))
        .accounts({
          authority: wallet.publicKey,
        })
        .rpc();

      console.log("Your transaction signature", tx);
      message.success("Minimum stake period updated successfully!. Your transaction id is " + tx);
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
    } finally {
      setLoadingUpdate(false);
    }
  };

  const handleDepositRewards = async (values) => {
    try {
      setLoadingDeposit(true);
      console.log("Deposit Rewards with value:", values.depositAmount);

      const userAssociatedTokenAccount = getUserAssociatedTokenAccountPublicKey();

      const tx = await program.methods
        .depositRewards(new anchor.BN(solToLamports(values.depositAmount)))
        .accounts({
          depositor: wallet.publicKey,
          depositorAta: userAssociatedTokenAccount,
          tokenMint: new anchor.web3.PublicKey(tokenMint),
        })
        .rpc();

      console.log("Your transaction signature", tx);
      message.success("Rewards deposited successfully!. Your transaction id is " + tx);
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
    } finally {
      setLoadingDeposit(false);
    }
  };

  const handleWithdrawRewards = async () => {
    try {
      setLoadingWithdraw(true);
      console.log("Withdraw Rewards");

      const configKeys = getConfigKeys();

      const userAssociatedTokenAccount = getUserAssociatedTokenAccountPublicKey();

      const tx = await program.methods
        .withdraw(configKeys.configPdaBump)
        .accounts({
          authority: wallet.publicKey,
          authorityAta: userAssociatedTokenAccount,
          tokenMint: new anchor.web3.PublicKey(tokenMint),
        })
        .rpc();

      console.log("Your transaction signature", tx);
      message.success("Rewards withdrawn successfully!. Your transaction id is " + tx);
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
    } finally {
      setLoadingWithdraw(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <Card title="Contract Address" bordered={false} style={{ marginBottom: "20px", wordWrap: "break-word" }}>
            <p>{contractAddress}</p>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card title="Staking Token Address" bordered={false} style={{ marginBottom: "20px", wordWrap: "break-word" }}>
            <p>{tokenMint}</p>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card title="Staking Token Decimals" bordered={false} style={{ marginBottom: "20px" }}>
            <p>{tokenDecimals}</p>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <Card title="Tax" bordered={false} style={{ marginBottom: "20px" }}>
            <p>{tokenTax} %</p>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card title="Minimum Stake Period" bordered={false} style={{ marginBottom: "20px" }}>
            <p>{minimumStakePeriod}</p>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card title="Stake Pool Balance" bordered={false} style={{ marginBottom: "20px" }}>
            <p>{rewardsBalance}</p>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <Card title="Owner" bordered={false} style={{ marginBottom: "20px" }}>
            <p>{authorityAddress}</p>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={24} md={12}>
          <Card title="Initialize Contract" bordered={false} style={{ marginBottom: "20px" }}>
            <Form layout="vertical" onFinish={handleInitializeContract}>
              <Form.Item
                name="minimumStakePeriod"
                label="Minimum Stake Period (Days)"
                rules={[{ required: true, message: "Please input the minimum stake period!" }]}
              >
                <Input placeholder="Minimum Stake Period" />
              </Form.Item>
              <Form.Item
                name="stakingTokenMintAddress"
                label="Staking Token Mint Address"
                rules={[{ required: true, message: "Please input the staking token mint address!" }]}
              >
                <Input placeholder="Staking Token Mint Address" />
              </Form.Item>
              <Form.Item name="decimals" label="Decimals" rules={[{ required: true, message: "Please input the decimals!" }]}>
                <Input placeholder="Decimals" />
              </Form.Item>
              <Form.Item
                name="tokenTax"
                label="Token Tax (%)"
                rules={[{ required: true, message: "Please input the token tax!" }]}
              >
                <Input placeholder="Token Tax (%)" />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loadingInitialize}
                  style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
                >
                  Initialize Contract
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} sm={24} md={12}>
          <Card title="Update Minimum Stake Period" bordered={false} style={{ marginBottom: "20px" }}>
            <Form layout="vertical" onFinish={handleUpdateMinimumStakePeriod}>
              <Form.Item
                name="minimumStakePeriod"
                label="Minimum Stake Period"
                rules={[{ required: true, message: "Please input the minimum stake period!" }]}
              >
                <Input placeholder="Minimum Stake Period" />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loadingUpdate}
                  style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
                >
                  Update
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={24} md={12}>
          <Card title="Deposit Rewards" bordered={false} style={{ marginBottom: "20px" }}>
            <Form layout="vertical" onFinish={handleDepositRewards}>
              <Form.Item
                name="depositAmount"
                label="Deposit Amount"
                rules={[{ required: true, message: "Please input the deposit amount!" }]}
              >
                <Input placeholder="Deposit Amount" />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loadingDeposit}
                  style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
                >
                  Deposit
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} sm={24} md={12}>
          <Card title="Withdraw Stake Pool Balance" bordered={false} style={{ marginBottom: "20px" }}>
            <Button
              type="primary"
              onClick={handleWithdrawRewards}
              loading={loadingWithdraw}
              style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
            >
              Withdraw
            </Button>
          </Card>
        </Col>
      </Row>
      <style jsx>{`
        @media (max-width: 390px) {
          .ant-card {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
