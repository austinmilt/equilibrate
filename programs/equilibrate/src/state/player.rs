use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Copy, PartialEq)]
pub struct PlayerState {
    pub game: Pubkey,
    pub bucket: u64,
}

impl PlayerState {
    pub fn get_space() -> usize {
        8 + // account discriminator
        32 + // game
        8 // bucket
    }

    pub fn log_make(&self) {
        msg!(
            "Initialized player for game {} in bucket {}",
            self.game,
            self.bucket
        );
    }

    pub fn log_move(&self) {
        msg!("Moved to bucket {} in game {}", self.bucket, self.game);
    }

    pub fn log_leave(&self, winnings: u64) {
        msg!(
            "Left game {} with winnings (with decimals) {}",
            self.game,
            winnings
        );
    }
}
