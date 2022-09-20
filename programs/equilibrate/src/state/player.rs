use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Copy, PartialEq)]
pub struct PlayerState {
    pub bucket: u64,
}

impl PlayerState {
    pub fn get_space() -> usize {
        8 + // account discriminator
        8 // bucket
    }

    pub fn log_make(&self) {
        msg!(
            "Initialized player in bucket {}",
            self.bucket
        );
    }

    pub fn log_move(&self) {
        msg!("Moved to bucket {}", self.bucket);
    }

    pub fn log_leave(&self, winnings: u64) {
        msg!(
            "Left with winnings (with decimals) {}",
            winnings
        );
    }
}
