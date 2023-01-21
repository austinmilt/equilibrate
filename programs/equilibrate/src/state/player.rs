use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Copy, PartialEq)]
pub struct PlayerState {
    pub version: u8,
    pub bucket: u8,
    pub burn_penalty_decimal_tokens: u64,
    pub player: Pubkey,
}

impl PlayerState {
    pub fn get_space() -> usize {
        8 + // account discriminator
        1 + // version
        1 + // bucket
        8 + // burn_penalty_decimal_tokens
        32 // player
    }

    pub fn log_make(&self) {
        msg!("Initialized player in bucket {}", self.bucket);
    }

    pub fn log_move(&self) {
        if self.burn_penalty_decimal_tokens > 0 {
            msg!(
                "Moved to bucket {}. Burn penalty now {} decimal tokens",
                self.bucket,
                self.burn_penalty_decimal_tokens
            );
        } else {
            msg!("Moved to bucket {}", self.bucket);
        }
    }

    pub fn log_leave(&self, winnings: u64) {
        msg!("Left and won {} decimal tokens", winnings);
    }
}
