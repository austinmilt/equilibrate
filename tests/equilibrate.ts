import * as anchor from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Program } from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import { CreatePoolContext, setUpCreatePool } from "./createPool";
import { EnterGameContext, setUpEnterGame } from "./enterGame";
import { generateGameConfig } from "./helpers/game";
import {
  generateMint,
  getTokenPoolBalanceWithDecimals,
  makeAndFundWallet,
} from "./helpers/token";
import { GameConfig } from "./helpers/types";
import { LeaveGameContext, setUpLeaveGame } from "./leaveGame";
import { MoveBucketsContext, setUpMoveBuckets } from "./moveBuckets";
import { NewGameContext, setUpNewGame } from "./newGame";
import { repeat } from "./helpers/test";
import { getPoolManagerAddress, getTokenPoolAddress } from "./helpers/address";
import { assert } from "chai";

describe("Game simulation tests", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Equilibrate as Program<Equilibrate>;

  it("check that multiple games with the same configs can run concurrently", async () => {
    const gameA: GameRunner = await GameRunner.random(program);
    const gameB: GameRunner = gameA.withSameConfig();
    // need to start gameA before gameB to avoid trying to create the token pool/manager twice
    await gameA.start();
    await gameB.start();
    await Promise.all([gameA.step(20), gameB.step(20)]);
    await Promise.all([gameA.finish(), gameB.finish()]);
  });

  it("concurrent games of same mint dont steal tokens from one another", async () => {
    const gameA: GameRunner = await GameRunner.random(program);
    const games: GameRunner[] = [gameA, ...Array(9).fill(null).map(() => gameA.withSameConfig())]
    await games[0].start();
    await Promise.all(games.slice(1).map(g => g.start()));
    await Promise.all(games.map(g => g.step(5)));
    await Promise.all(games.map(g => g.finish()));

    const newGameContext: NewGameContext = gameA.getNewGameContext();

    const tokenPoolBalance: number = await getTokenPoolBalanceWithDecimals(
      newGameContext.gameConfig.mint,
      program.programId,
      program.provider.connection
    );

    // it would be extremely unlikely for any of these games to complete erroneously without
    // one of them either leaving tokens in the pool or trying to withdraw more
    // tokens than are in the pool, so while this check doesnt actually confirm
    // that everyone gets the tokens they deserve, it should be a pretty
    // dependable check that games arent stealing from one another
    assert.strictEqual(tokenPoolBalance, 0);
  });

  it(
    "simulate a game playing through without error",
    repeat(10, async () => {
      const game: GameRunner = await GameRunner.random(program);
      await game.start();
      await game.step(100);
      await game.finish();
    })
  );
});

interface PlayerContext {
  enterGameContext: EnterGameContext;
  moveBucketsContexts: MoveBucketsContext[] | undefined;
  leaveGameContext: LeaveGameContext | undefined;
}

class GameRunner {
  private readonly program: anchor.Program<Equilibrate>;
  private readonly mint: Keypair;
  private readonly mintAuthority: Keypair;
  private readonly gameConfig: GameConfig;
  private createPoolContext: CreatePoolContext | undefined;
  private newGameContext: NewGameContext | undefined;
  private readonly playerContexts: PlayerContext[] = [];
  private readonly debug: boolean;

  private constructor(
    gameConfig: GameConfig,
    mint: Keypair,
    mintAuthority: Keypair,
    program: anchor.Program<Equilibrate>,
    debug: boolean = false
  ) {
    this.gameConfig = gameConfig;
    this.mint = mint;
    this.mintAuthority = mintAuthority;
    this.program = program;
    this.debug = debug;
  }

  public static async random(
    program: anchor.Program<Equilibrate>,
    debug?: boolean
  ): Promise<GameRunner> {
    const mintAuthority: Keypair = await makeAndFundWallet(
      100,
      program.provider.connection
    );
    const mint: Keypair = await generateMint(
      mintAuthority,
      program.provider.connection
    );
    return new GameRunner(
      generateGameConfig(mint.publicKey),
      mint,
      mintAuthority,
      program,
      debug
    );
  }

  public static withConfig(
    gameConfig: GameConfig,
    mint: Keypair,
    mintAuthority: Keypair,
    program: anchor.Program<Equilibrate>,
    debug?: boolean
  ): GameRunner {
    return new GameRunner(gameConfig, mint, mintAuthority, program, debug);
  }

  public withSameConfig(): GameRunner {
    return GameRunner.withConfig(
      this.gameConfig,
      this.mint,
      this.mintAuthority,
      this.program,
      this.debug
    );
  }

  public async start(): Promise<void> {
    const poolManagerAddress: PublicKey = (
      await getPoolManagerAddress(this.mint.publicKey, this.program.programId)
    )[0];
    const poolManagerExists: boolean =
      (await this.program.provider.connection.getAccountInfo(
        poolManagerAddress
      )) != null;
    const tokenPoolAddress: PublicKey = await getTokenPoolAddress(
      this.mint.publicKey,
      this.program.programId
    );
    const tokenPoolExists: boolean =
      (await this.program.provider.connection.getAccountInfo(
        tokenPoolAddress
      )) != null;

    if (!poolManagerExists || !tokenPoolExists) {
      this.createPoolContext = await setUpCreatePool(
        this.program,
        {
          mint: this.mint,
          mintAuthority: this.mintAuthority,
        },
        this.debug
      );
    } else {
      this.createPoolContext = {
        poolManagerAddress: poolManagerAddress,
        tokenPoolAddress: tokenPoolAddress,
        mint: this.mint,
        mintAuthority: this.mintAuthority,
      };
    }

    if (this.createPoolContext === undefined) {
      throw new Error("Need to run createPool before starting the game.");
    }

    const newGameContext: NewGameContext = await setUpNewGame(
      this.program,
      this.createPoolContext,
      {
        gameConfig: this.gameConfig,
      },
      this.debug
    );
    this.newGameContext = newGameContext;
    this.playerContexts.push({
      enterGameContext: {
        ...newGameContext,
        playerBucketIndex: 1,
      },
      moveBucketsContexts: undefined,
      leaveGameContext: undefined,
    });
  }

  public async step(nSteps: number = 1): Promise<void> {
    let activePlayers: PlayerContext[] = this.playerContexts.filter(
      (c) => c.leaveGameContext === undefined
    );
    if (activePlayers.length === 0) {
      throw new Error("No active players left");
    }
    for (let i = 0; i < nSteps; i++) {
      activePlayers = this.playerContexts.filter(
        (c) => c.leaveGameContext === undefined
      );
      if (activePlayers.length === 0) {
        return;
      }
      const event: Event = chooseEvent(
        this.playerContexts.length < this.gameConfig.maxPlayers.toNumber()
      );
      if (event === Event.ENTER) {
        await this.playerEnters();
      } else if (event === Event.MOVE) {
        await this.playerMoves(choose(activePlayers));
      } else {
        await this.playerLeaves(choose(activePlayers));
      }
    }
  }

  private async playerEnters(): Promise<void> {
    const context: EnterGameContext = await setUpEnterGame(
      this.program,
      this.createPoolContext,
      this.newGameContext,
      undefined,
      this.debug
    );
    this.playerContexts.push({
      enterGameContext: context,
      moveBucketsContexts: undefined,
      leaveGameContext: undefined,
    });
  }

  private async playerMoves(playerContext: PlayerContext): Promise<void> {
    let currentBucketIndex: number;
    if (playerContext.moveBucketsContexts === undefined) {
      currentBucketIndex = playerContext.enterGameContext.playerBucketIndex;
    } else {
      currentBucketIndex =
        playerContext.moveBucketsContexts[
          playerContext.moveBucketsContexts.length - 1
        ].newBucketIndex;
    }
    let newBucketIndex: number = currentBucketIndex;
    while (currentBucketIndex === newBucketIndex) {
      newBucketIndex = Math.floor(
        Math.random() *
          (this.newGameContext.gameConfig.nBuckets.toNumber() - 1) +
          1
      );
    }
    const context: MoveBucketsContext = await setUpMoveBuckets(
      this.program,
      this.createPoolContext,
      this.newGameContext,
      playerContext.enterGameContext,
      {
        newBucketIndex: newBucketIndex,
      },
      this.debug
    );

    if (playerContext.moveBucketsContexts === undefined) {
      playerContext.moveBucketsContexts = [];
    }
    playerContext.moveBucketsContexts.push(context);
    this.replacePlayerContext(playerContext);
  }

  private async playerLeaves(playerContext: PlayerContext): Promise<void> {
    const context: LeaveGameContext = await setUpLeaveGame(
      this.program,
      this.createPoolContext,
      this.newGameContext,
      playerContext.enterGameContext,
      undefined,
      this.debug
    );

    playerContext.leaveGameContext = context;
    this.replacePlayerContext(playerContext);
  }

  private replacePlayerContext(playerContext: PlayerContext): void {
    const playerStateAddress: string =
      playerContext.enterGameContext.playerStateAddress.toBase58();
    const playerContextIndex: number = this.playerContexts.findIndex(
      (c) =>
        c.enterGameContext.playerStateAddress.toBase58() === playerStateAddress
    );
    // guaranteed to be in the player contexts, so dont need to check for -1
    this.playerContexts[playerContextIndex] = playerContext;
  }

  public async finish(): Promise<void> {
    for (const playerContext of this.playerContexts) {
      if (playerContext.leaveGameContext === undefined) {
        await this.playerLeaves(playerContext);
      }
    }
  }

  public gameIsOver(): boolean {
    return this.playerContexts.every((c) => c.leaveGameContext !== undefined);
  }

  public getNewGameContext(): NewGameContext {
    return this.newGameContext;
  }
}

enum Event {
  ENTER,
  MOVE,
  LEAVE,
}

const EVENTS: Event[] = [Event.ENTER, Event.MOVE, Event.LEAVE];
const EVENTS_WITHOUT_ENTER: Event[] = [Event.MOVE, Event.LEAVE];

function chooseEvent(allowEnter: boolean = true): Event {
  return choose(allowEnter ? EVENTS : EVENTS_WITHOUT_ENTER);
}

function choose<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}
