use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::{
    constants::{POOL_MANAGER_SEED, POOL_SEED},
    id,
    model::EquilibrateError,
};

#[account]
#[derive(Debug, Copy, PartialEq)]
pub struct PoolManager {
    pub bump: u8,
}

impl PoolManager {
    pub fn get_space() -> usize {
        8 + // account discriminator
        1 // manager bump
    }

    pub fn validate_token_pool(
        token_pool: &Account<'_, TokenAccount>,
        manager_address: Pubkey,
        game_mint: Pubkey,
    ) -> Result<()> {
        let (expected_manager_address, _) = PoolManager::get_address(game_mint);
        require_keys_eq!(
            manager_address,
            expected_manager_address,
            EquilibrateError::InvalidPoolManager
        );
        let pool_seeds = [
            POOL_SEED.as_ref(),
            game_mint.as_ref(),
            manager_address.as_ref(),
        ];
        let (expected_address, _) = Pubkey::find_program_address(&pool_seeds, &id());
        require_keys_eq!(
            token_pool.key(),
            expected_address,
            EquilibrateError::InvalidTokenPool
        );
        require_keys_eq!(
            token_pool.owner,
            manager_address,
            EquilibrateError::InvalidTokenPoolOwner
        );
        Ok(())
    }

    fn get_address(game_mint: Pubkey) -> (Pubkey, u8) {
        let seeds = [POOL_MANAGER_SEED.as_ref(), game_mint.as_ref()];
        Pubkey::find_program_address(&seeds, &id())
    }

    pub fn log_make(&self) {
        msg!("Initialized pool manager with bump {}", self.bump);
    }
}
