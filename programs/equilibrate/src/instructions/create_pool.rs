use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::{POOL_MANAGER_SEED, POOL_SEED},
    id,
    model::EquilibrateError,
    state::PoolManager,
};

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(
        init,
        seeds = [
            POOL_MANAGER_SEED.as_ref(),
            game_mint.key().as_ref(),
        ],
        bump,
        space = PoolManager::get_space(),
        payer = payer,
        owner = id()
        @EquilibrateError::InvalidPoolManagerOwner
    )]
    pub pool_manager: Account<'info, PoolManager>,

    #[account(
        init,
        seeds = [
            POOL_SEED.as_ref(),
            game_mint.key().as_ref(),
            pool_manager.key().as_ref(),
        ],
        bump,
        payer = payer,
        token::mint = game_mint,
        token::authority = pool_manager,
    )]
    pub token_pool: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub game_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

pub fn create_pool(_: Context<CreatePool>) -> Result<()> {
    Ok(())
}
