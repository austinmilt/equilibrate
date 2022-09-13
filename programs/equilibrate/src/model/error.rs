use anchor_lang::prelude::*;

#[error_code]
pub enum EquilibrateError {
    #[msg("Entry fee must be positive")]
    InvalidEntryFee,

    #[msg("Number of buckets must be positive")]
    TooFewBuckets,

    #[msg("Game cannot have more than 64 buckets")]
    TooManyBuckets,

    #[msg("Game is at capacity")]
    GameAtCapacity,

    #[msg("Token spill rate must be positive")]
    InvalidSpillRate,

    #[msg("Game must allow more than 1 player")]
    InvalidMaxPlayers,

    #[msg("Attempted to enter a bucket that doesnt exist")]
    BucketDoesNotExist,

    #[msg("Not allowed to enter the holding bucket (index 0)")]
    CannotEnterHoldingBucket,

    #[msg("Attempted to enter move within the same bucket")]
    AlreadyInBucket,

    #[msg("Attempted to enter a game that has already ended")]
    GameIsOver,

    #[msg("Program fee pubkey must be the one hard-coded in the program")]
    InvalidProgramFeeDestination,

    #[msg("Pool mint must be the one configured for the game")]
    InvalidPoolMint,

    #[msg("Pool owner must be the program")]
    InvalidPoolOwner,

    #[msg("Token source acount mint must be the one configured for the game")]
    InvalidTokenSourceMint,

    #[msg("Program ID must be this program")]
    InvalidProgramId,

    #[msg("Player state account doesnt belong to this game")]
    InvalidPlayerState,
}
