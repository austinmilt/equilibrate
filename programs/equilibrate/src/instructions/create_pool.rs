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
    /// account that signs for token payouts from the token pool
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

    /// token pool for all games played with `game_mint`
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

    /// payer to create the token pool and pool manager accounts
    #[account(mut)]
    pub payer: Signer<'info>,

    /// mint of the token pool for all games of this mint
    pub game_mint: Account<'info, Mint>,

    /// standard SPL token program, for creating the token pool
    pub token_program: Program<'info, Token>,

    /// standard rent sysvar, for determining rent for created accounts
    pub rent: Sysvar<'info, Rent>,

    /// standard system program, for creating accounts
    pub system_program: Program<'info, System>,
}

pub fn create_pool(ctx: Context<CreatePool>, pool_manager_bump: u8) -> Result<()> {
    ctx.accounts.pool_manager.bump = pool_manager_bump;

    Ok(())
}
