pub const GAME_MAX_BUCKETS: u64 = 64;
pub const PROGRAM_FEE_LAMPORTS: u64 = 15000000;
// PubKey("EQui1fSdC2HetpETDAoaLaPYvYR7xVuXmLyUiiEvfA2h").as_ref()
// or (in ts) new PublicKey("EQui1fSdC2HetpETDAoaLaPYvYR7xVuXmLyUiiEvfA2h").toBuffer()
pub const PROGRAM_FEE_DESTINATION: &[u8] = &[
    199, 71, 226, 127, 27, 142, 50, 250, 123, 57, 93, 205, 218, 14, 3, 202, 40, 26, 200, 127, 61,
    237, 60, 136, 154, 161, 13, 86, 32, 199, 43, 198,
];
