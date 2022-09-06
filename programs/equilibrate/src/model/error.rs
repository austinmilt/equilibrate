use anchor_lang::prelude::*;

#[error_code]
pub enum EquilibrateError {
    #[msg("Entry fee must be positive.")]
    InvalidEntryFee,

    #[msg("Number of buckets must be positive.")]
    TooFewBuckets,

    #[msg(format!("Game cannot have more than {} buckets.", GAME_MAX_BUCKETS))]
    TooManyBuckets,

    #[msg("Token spill rate must be positive.")]
    InvalidSpillRate,

    #[msg("Attempted to enter a bucket that doesnt exist.")]
    BucketDoesNotExist,

    #[msg("Attempted to enter move within the same bucket.")]
    AlreadyInBucket,

    #[msg("Attempted to enter a game that has already ended.")]
    GameIsOver,

    #[msg("Error locating player account to get winnings.")]
    CouldNotFindPlayer,
}
