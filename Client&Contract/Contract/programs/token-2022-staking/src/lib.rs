use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022_extensions::transfer_fee::{transfer_checked_with_fee, TransferCheckedWithFee},
    token_interface::{Mint, Token2022, TokenAccount},
};

use spl_token_2022::extension::{transfer_fee::TransferFeeConfig, StateWithExtensions};

declare_id!("DFgDg9Mc69FcWcsSHTPimE35x3W8uGdAZGCGWSeseFWh");

#[program]
pub mod token_2022_staking {

    use spl_token_2022::extension::BaseStateWithExtensions;

    use super::*;

    /**
     *! 1. INITIALIZE
     */
    pub fn initialize(
        ctx: Context<Initialize>,
        min_stake_period: i64,
        decimals: u8,
        tax_percentage: u8,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        config.authority = *ctx.accounts.authority.key;
        config.min_stake_period = min_stake_period;
        config.token_mint_address = *ctx.accounts.token_mint.to_account_info().key;
        config.decimals = decimals;
        config.tax_percentage = tax_percentage;
        Ok(())
    }

    /**
     *! 2. UPDATE MINIMUM STAKE PERIOD (Admin Only)
     */
    pub fn update_min_stake_period(
        ctx: Context<UpdateMinStakePeriod>,
        min_stake_period: i64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(
            *ctx.accounts.authority.key == config.authority,
            ErrorCode::Unauthorized
        );

        config.min_stake_period = min_stake_period;

        Ok(())
    }

    /**
     *! 3. DEPOSIT TOKENS INTO CONTRACT
     */

    pub fn deposit_rewards(ctx: Context<DepositRewards>, amount: u64) -> Result<()> {
        if ctx.accounts.config.token_mint_address != ctx.accounts.token_mint.key() {
            return Err(ErrorCode::TokenMintMismatch.into());
        }

        // Transfer tokens from the depositor to the contract's reward account
        let cpi_accounts = TransferCheckedWithFee {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            source: ctx.accounts.depositor_ata.to_account_info(),
            destination: ctx.accounts.config_ata.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        let token_tax_percentage = ctx.accounts.config.tax_percentage as u64;
        let token_decimals = ctx.accounts.config.decimals;

        // -- Maximum Fee

        let mint = &ctx.accounts.token_mint.to_account_info();

        // Load the TransferFeeConfig extension data
        let mint_data = mint.data.borrow();
        let state_with_extensions =
            StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;

        let transfer_fee_config = state_with_extensions
            .get_extension::<TransferFeeConfig>()
            .map_err(|_| ErrorCode::NoTransferFeeConfig)?;

        let older_maximum_fee: u64 = transfer_fee_config.older_transfer_fee.maximum_fee.into();
        // let older_epoch: u64 = transfer_fee_config.older_transfer_fee.epoch.into();
        let newer_maximum_fee: u64 = transfer_fee_config.newer_transfer_fee.maximum_fee.into();
        let newer_epoch: u64 = transfer_fee_config.newer_transfer_fee.epoch.into();

        // Get the current epoch from the Clock sysvar
        let clock = Clock::get()?;
        let current_epoch = clock.epoch;

        let maximum_fee = if current_epoch < newer_epoch {
            older_maximum_fee
        } else {
            newer_maximum_fee
        };

        let fee = (amount * token_tax_percentage + 99) / 100;

        let mut final_fee = fee;

        if fee > maximum_fee {
            final_fee = maximum_fee;
        }

        transfer_checked_with_fee(cpi_ctx, amount, token_decimals, final_fee)?;

        Ok(())
    }

    /**
     *! 4. WITHDRAW TOKENS FROM CONTRACT (Admin Only)
     */

    pub fn withdraw(ctx: Context<Withdraw>, config_pda_bump: u8) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(
            *ctx.accounts.authority.key == config.authority,
            ErrorCode::Unauthorized
        );

        if config.token_mint_address != ctx.accounts.token_mint.key() {
            return Err(ErrorCode::TokenMintMismatch.into());
        }

        // Transfer Tokens from contract account to user account
        let cpi_accounts = TransferCheckedWithFee {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            source: ctx.accounts.config_ata.to_account_info(),
            destination: ctx.accounts.authority_ata.to_account_info(),
            authority: config.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();

        let seeds: &[&[&[u8]]] = &[&[CONFIG_PDA_SEED, &[config_pda_bump]]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds);

        let total_reward_balance = ctx.accounts.config_ata.amount;

        let token_tax_percentage = config.tax_percentage as u64;
        let token_decimals = config.decimals;

        // -- Maximum Fee

        let mint = &ctx.accounts.token_mint.to_account_info();

        // Load the TransferFeeConfig extension data
        let mint_data = mint.data.borrow();
        let state_with_extensions =
            StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;

        let transfer_fee_config = state_with_extensions
            .get_extension::<TransferFeeConfig>()
            .map_err(|_| ErrorCode::NoTransferFeeConfig)?;

        let older_maximum_fee: u64 = transfer_fee_config.older_transfer_fee.maximum_fee.into();
        // let older_epoch: u64 = transfer_fee_config.older_transfer_fee.epoch.into();
        let newer_maximum_fee: u64 = transfer_fee_config.newer_transfer_fee.maximum_fee.into();
        let newer_epoch: u64 = transfer_fee_config.newer_transfer_fee.epoch.into();

        // Get the current epoch from the Clock sysvar
        let clock = Clock::get()?;
        let current_epoch = clock.epoch;

        let maximum_fee = if current_epoch < newer_epoch {
            older_maximum_fee
        } else {
            newer_maximum_fee
        };

        let fee = (total_reward_balance * token_tax_percentage + 99) / 100; // Adding 99 for correct rounding

        let mut final_fee = fee;

        if fee > maximum_fee {
            final_fee = maximum_fee;
        }

        transfer_checked_with_fee(cpi_ctx, total_reward_balance, token_decimals, final_fee)?;

        Ok(())
    }

    /**
     *! 5a. STAKE
     */
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        if ctx.accounts.config.token_mint_address != ctx.accounts.token_mint.key() {
            return Err(ErrorCode::TokenMintMismatch.into());
        }

        let user_stake_account = &mut ctx.accounts.user_stake_account;

        // Transfer Tokens from user account to contract account
        let cpi_accounts = TransferCheckedWithFee {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            source: ctx.accounts.user_ata.to_account_info(),
            destination: ctx.accounts.config_ata.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        let token_tax_percentage = ctx.accounts.config.tax_percentage as u64;
        let token_decimals = ctx.accounts.config.decimals;

        // -- Maximum Fee

        let mint = &ctx.accounts.token_mint.to_account_info();

        // Load the TransferFeeConfig extension data
        let mint_data = mint.data.borrow();
        let state_with_extensions =
            StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;

        let transfer_fee_config = state_with_extensions
            .get_extension::<TransferFeeConfig>()
            .map_err(|_| ErrorCode::NoTransferFeeConfig)?;

        let older_maximum_fee: u64 = transfer_fee_config.older_transfer_fee.maximum_fee.into();
        // let older_epoch: u64 = transfer_fee_config.older_transfer_fee.epoch.into();
        let newer_maximum_fee: u64 = transfer_fee_config.newer_transfer_fee.maximum_fee.into();
        let newer_epoch: u64 = transfer_fee_config.newer_transfer_fee.epoch.into();

        // Get the current epoch from the Clock sysvar
        let clock = Clock::get()?;
        let current_epoch = clock.epoch;

        let maximum_fee = if current_epoch < newer_epoch {
            older_maximum_fee
        } else {
            newer_maximum_fee
        };

        let fee = (amount * token_tax_percentage + 99) / 100; // Adding 99 for correct rounding

        let mut final_fee = fee;

        if fee > maximum_fee {
            final_fee = maximum_fee;
        }

        transfer_checked_with_fee(cpi_ctx, amount, token_decimals, final_fee)?;

        // Store Record
        user_stake_account.authority = ctx.accounts.user.key();

        let final_stake_value = amount - final_fee;

        user_stake_account.stakes.push(StakeRecord {
            amount: final_stake_value,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     *! 5b. STAKE
     */
    pub fn stake_reallocx(ctx: Context<StakeRealloc>, amount: u64) -> Result<()> {
        if ctx.accounts.config.token_mint_address != ctx.accounts.token_mint.key() {
            return Err(ErrorCode::TokenMintMismatch.into());
        }

        let user_stake_account = &mut ctx.accounts.user_stake_account;

        // Transfer Tokens from user account to contract account
        let cpi_accounts = TransferCheckedWithFee {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            source: ctx.accounts.user_ata.to_account_info(),
            destination: ctx.accounts.config_ata.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        let token_tax_percentage = ctx.accounts.config.tax_percentage as u64;
        let token_decimals = ctx.accounts.config.decimals;

        // -- Maximum Fee

        let mint = &ctx.accounts.token_mint.to_account_info();

        // Load the TransferFeeConfig extension data
        let mint_data = mint.data.borrow();
        let state_with_extensions =
            StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;

        let transfer_fee_config = state_with_extensions
            .get_extension::<TransferFeeConfig>()
            .map_err(|_| ErrorCode::NoTransferFeeConfig)?;

        let older_maximum_fee: u64 = transfer_fee_config.older_transfer_fee.maximum_fee.into();
        // let older_epoch: u64 = transfer_fee_config.older_transfer_fee.epoch.into();
        let newer_maximum_fee: u64 = transfer_fee_config.newer_transfer_fee.maximum_fee.into();
        let newer_epoch: u64 = transfer_fee_config.newer_transfer_fee.epoch.into();

        // Get the current epoch from the Clock sysvar
        let clock = Clock::get()?;
        let current_epoch = clock.epoch;

        let maximum_fee = if current_epoch < newer_epoch {
            older_maximum_fee
        } else {
            newer_maximum_fee
        };

        let fee = (amount * token_tax_percentage + 99) / 100; // Adding 99 for correct rounding

        let mut final_fee = fee;

        if fee > maximum_fee {
            final_fee = maximum_fee;
        }

        transfer_checked_with_fee(cpi_ctx, amount, token_decimals, final_fee)?;

        // Store Record

        let final_stake_value = amount - final_fee;

        user_stake_account.stakes.push(StakeRecord {
            amount: final_stake_value,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     *! 6. UNSTAKE
     */

    pub fn unstake(ctx: Context<Unstake>, config_pda_bump: u8) -> Result<()> {
        if ctx.accounts.config.token_mint_address != ctx.accounts.token_mint.key() {
            return Err(ErrorCode::TokenMintMismatch.into());
        }

        let user_stake_account = &mut ctx.accounts.user_stake_account;
        let config = &mut ctx.accounts.config;

        let current_time = Clock::get()?.unix_timestamp;
        let annual_rate = 0.15; // APY of 15%
        let seconds_in_year = 365.0 * 24.0 * 3600.0;
        let second_rate = annual_rate / seconds_in_year; // Rate per second
        let min_stake_period_seconds = config.min_stake_period * 86_400;

        let mut total_reward = 0.0;
        let mut total_staked_amount = 0;

        for stake in user_stake_account.stakes.iter_mut() {
            let duration = current_time - stake.timestamp;
            if duration >= min_stake_period_seconds {
                let reward_duration = duration as f64; // Duration in seconds
                total_reward += stake.amount as f64 * second_rate * reward_duration;
                total_staked_amount += stake.amount;
            }
        }

        // Convert total_reward to u64
        let total_reward_u64 = total_reward as u64;

        let current_rewards_balance = ctx.accounts.config_ata.amount;

        // Ensure there are enough rewards in the contract
        if current_rewards_balance < total_reward_u64 {
            return Err(ErrorCode::InsufficientRewards.into());
        }

        // Calculate the total amount to transfer (rewards + staked amount)
        let total_amount_to_transfer = total_reward_u64 + total_staked_amount;

        // Transfer Tokens from contract account to user account
        let cpi_accounts = TransferCheckedWithFee {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            source: ctx.accounts.config_ata.to_account_info(),
            destination: ctx.accounts.user_ata.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();

        let seeds: &[&[&[u8]]] = &[&[CONFIG_PDA_SEED, &[config_pda_bump]]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds);

        let token_tax_percentage = ctx.accounts.config.tax_percentage as u64;
        let token_decimals = ctx.accounts.config.decimals;

        // -- Maximum Fee

        let mint = &ctx.accounts.token_mint.to_account_info();

        // Load the TransferFeeConfig extension data
        let mint_data = mint.data.borrow();
        let state_with_extensions =
            StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;

        let transfer_fee_config = state_with_extensions
            .get_extension::<TransferFeeConfig>()
            .map_err(|_| ErrorCode::NoTransferFeeConfig)?;

        let older_maximum_fee: u64 = transfer_fee_config.older_transfer_fee.maximum_fee.into();
        // let older_epoch: u64 = transfer_fee_config.older_transfer_fee.epoch.into();
        let newer_maximum_fee: u64 = transfer_fee_config.newer_transfer_fee.maximum_fee.into();
        let newer_epoch: u64 = transfer_fee_config.newer_transfer_fee.epoch.into();

        // Get the current epoch from the Clock sysvar
        let clock = Clock::get()?;
        let current_epoch = clock.epoch;

        let maximum_fee = if current_epoch < newer_epoch {
            older_maximum_fee
        } else {
            newer_maximum_fee
        };

        let fee = (total_amount_to_transfer * token_tax_percentage + 99) / 100;

        let mut final_fee = fee;

        if fee > maximum_fee {
            final_fee = maximum_fee;
        }

        transfer_checked_with_fee(cpi_ctx, total_amount_to_transfer, token_decimals, final_fee)?;

        // Remove all stakes
        user_stake_account.stakes.clear();

        Ok(())
    }

    /**
     *! 7. CLAIM REWARDS
     */

    pub fn claim_rewards(ctx: Context<ClaimRewards>, config_pda_bump: u8) -> Result<()> {
        if ctx.accounts.config.token_mint_address != ctx.accounts.token_mint.key() {
            return Err(ErrorCode::TokenMintMismatch.into());
        }

        let user_stake_account = &mut ctx.accounts.user_stake_account;
        let config = &mut ctx.accounts.config;

        let current_time = Clock::get()?.unix_timestamp;
        let annual_rate = 0.15; // APY of 15%
        let seconds_in_year = 365.0 * 24.0 * 3600.0;
        let second_rate = annual_rate / seconds_in_year; // Rate per second
        let min_stake_period_seconds = config.min_stake_period * 86_400;

        let mut total_reward = 0.0;

        for stake in user_stake_account.stakes.iter_mut() {
            let duration = current_time - stake.timestamp;

            msg!("Current Time: {}", current_time);
            msg!("Stake Timestamp: {}", stake.timestamp);
            msg!("Duration: {}", duration);
            msg!("Min Stake Period: {}", min_stake_period_seconds);
            msg!("Validation: {}", duration >= config.min_stake_period);

            if duration >= min_stake_period_seconds {
                let reward_duration = duration as f64; // Duration in seconds
                total_reward += stake.amount as f64 * second_rate * reward_duration;
                stake.timestamp = current_time;
            }
        }

        // Convert total_reward to u64
        let total_reward_u64 = total_reward as u64;

        let current_rewards_balance = ctx.accounts.config_ata.amount;

        msg!("Current Reward Balance: {}", current_rewards_balance);
        msg!("Total Rewards u64: {}", total_reward_u64);
        // Ensure there are enough rewards in the contract
        if current_rewards_balance < total_reward_u64 {
            return Err(ErrorCode::InsufficientRewards.into());
        }

        // Transfer Tokens from contract account to user account
        let cpi_accounts = TransferCheckedWithFee {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            source: ctx.accounts.config_ata.to_account_info(),
            destination: ctx.accounts.user_ata.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();

        let seeds: &[&[&[u8]]] = &[&[CONFIG_PDA_SEED, &[config_pda_bump]]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds);

        let token_tax_percentage = ctx.accounts.config.tax_percentage as u64;
        let token_decimals = ctx.accounts.config.decimals;

        // -- Maximum Fee

        let mint = &ctx.accounts.token_mint.to_account_info();

        // Load the TransferFeeConfig extension data
        let mint_data = mint.data.borrow();
        let state_with_extensions =
            StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;

        let transfer_fee_config = state_with_extensions
            .get_extension::<TransferFeeConfig>()
            .map_err(|_| ErrorCode::NoTransferFeeConfig)?;

        let older_maximum_fee: u64 = transfer_fee_config.older_transfer_fee.maximum_fee.into();
        // let older_epoch: u64 = transfer_fee_config.older_transfer_fee.epoch.into();
        let newer_maximum_fee: u64 = transfer_fee_config.newer_transfer_fee.maximum_fee.into();
        let newer_epoch: u64 = transfer_fee_config.newer_transfer_fee.epoch.into();

        // Get the current epoch from the Clock sysvar
        let clock = Clock::get()?;
        let current_epoch = clock.epoch;

        let maximum_fee = if current_epoch < newer_epoch {
            older_maximum_fee
        } else {
            newer_maximum_fee
        };

        let fee = (total_reward_u64 * token_tax_percentage + 99) / 100;

        let mut final_fee = fee;

        if fee > maximum_fee {
            final_fee = maximum_fee;
        }

        transfer_checked_with_fee(cpi_ctx, total_reward_u64, token_decimals, final_fee)?;

        Ok(())
    }
}

// ----------------------------------------------------------------------------------------------
//                                  Instruction Contexts
// ----------------------------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [CONFIG_PDA_SEED.as_ref()],
        bump,
        payer = authority,
        space = Config::LEN
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        seeds = [CONFIG_ATA_SEED.as_ref()],
        bump,
        payer = authority,
        token::mint = token_mint,
        token::authority = config,
        token::token_program = token_program,
    )]
    pub config_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct UpdateMinStakePeriod<'info> {
    #[account(
        seeds = [CONFIG_PDA_SEED.as_ref()],
        bump,
        mut
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositRewards<'info> {
    #[account(
        seeds = [CONFIG_PDA_SEED.as_ref()],
        bump,
        mut
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [CONFIG_ATA_SEED.as_ref()],
        bump,
        mut,
        token::mint = token_mint,
        token::authority = config,
        token::token_program = token_program,
    )]
    pub config_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = depositor,
        token::token_program = token_program,
    )]
    pub depositor_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [CONFIG_PDA_SEED.as_ref()],
        bump,
        mut
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [CONFIG_ATA_SEED.as_ref()],
        bump,
        mut,
        token::mint = token_mint,
        token::authority = config,
        token::token_program = token_program,
    )]
    pub config_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = authority,
        token::token_program = token_program,
    )]
    pub authority_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        seeds = [CONFIG_PDA_SEED.as_ref()],
        bump,
        mut
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [CONFIG_ATA_SEED.as_ref()],
        bump,
        mut,
        token::mint = token_mint,
        token::authority = config,
        token::token_program = token_program,
    )]
    pub config_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        seeds = [user.key().as_ref()],
        bump,
        payer = user,
        space = UserStakeAccount::LEN
    )]
    pub user_stake_account: Account<'info, UserStakeAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = user,
        token::token_program = token_program,
    )]
    pub user_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct StakeRealloc<'info> {
    #[account(
        seeds = [CONFIG_PDA_SEED.as_ref()],
        bump,
        mut
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [CONFIG_ATA_SEED.as_ref()],
        bump,
        mut,
        token::mint = token_mint,
        token::authority = config,
        token::token_program = token_program,
    )]
    pub config_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [user.key().as_ref()],
        bump,
        mut,
        realloc = UserStakeAccount::LEN  + std::mem::size_of_val(&user_stake_account) + std::mem::size_of::<UserStakeAccount>(),
        realloc::payer = user,
        realloc::zero = false,
    )]
    pub user_stake_account: Account<'info, UserStakeAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = user,
        token::token_program = token_program,
    )]
    pub user_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(
        seeds = [CONFIG_PDA_SEED.as_ref()],
        bump,
        mut
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [CONFIG_ATA_SEED.as_ref()],
        bump,
        mut,
        token::mint = token_mint,
        token::authority = config,
        token::token_program = token_program,
    )]
    pub config_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [user.key().as_ref()],
        bump,
        mut
    )]
    pub user_stake_account: Account<'info, UserStakeAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = user,
        token::token_program = token_program,
    )]
    pub user_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        seeds = [CONFIG_PDA_SEED.as_ref()],
        bump,
        mut
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [CONFIG_ATA_SEED.as_ref()],
        bump,
        mut,
        token::mint = token_mint,
        token::authority = config,
        token::token_program = token_program,
    )]
    pub config_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [user.key().as_ref()],
        bump,
        mut
    )]
    pub user_stake_account: Account<'info, UserStakeAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = user,
        token::token_program = token_program,
    )]
    pub user_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

// ----------------------------------------------------------------------------------------------
//                                  PDAs
// ----------------------------------------------------------------------------------------------

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub min_stake_period: i64,
    pub token_mint_address: Pubkey,
    pub decimals: u8,
    pub tax_percentage: u8,
}

impl Config {
    const DISCRIMINATOR: usize = 8;
    pub const LEN: usize = Self::DISCRIMINATOR + 32 + 8 + 32 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StakeRecord {
    pub amount: u64,
    pub timestamp: i64,
}

impl StakeRecord {
    pub const LEN: usize = 8 + 8;
}

#[account]
pub struct UserStakeAccount {
    pub authority: Pubkey,
    pub stakes: Vec<StakeRecord>,
}

impl UserStakeAccount {
    pub const DISCRIMINATOR: usize = 8;
    pub const VECTOR_LENGTH_PREFIX: usize = 4;
    const STAKE_RECORD_COUNT: usize = 1; // For more than 1 stake record at a time, user will pay

    pub const LEN: usize = Self::DISCRIMINATOR
        + 32
        + (Self::VECTOR_LENGTH_PREFIX + (StakeRecord::LEN * Self::STAKE_RECORD_COUNT));
}

// ----------------------------------------------------------------------------------------------
//                                  ERRORS
// ----------------------------------------------------------------------------------------------

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized, // 6000
    #[msg("Insufficient rewards in the contract account")]
    InsufficientRewards, // 6001
    #[msg("The token mint address does not match the config.")] // 6002
    TokenMintMismatch,
    #[msg("No transfer fee configuration found for this mint.")] // 6003
    NoTransferFeeConfig,
}

// ----------------------------------------------------------------------------------------------
//                                  SEEDS
// ----------------------------------------------------------------------------------------------

pub const CONFIG_PDA_SEED: &[u8] = b"config-pda-1";
pub const CONFIG_ATA_SEED: &[u8] = b"config-ata-1";
