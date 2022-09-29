import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { assert } from "chai";
import { Equilibrate } from "../target/types/equilibrate";

describe("dummy", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Equilibrate as Program<Equilibrate>;

  it("check that multiple games with the same configs can run concurrently", async () => {
    assert(false);
  });

  it("check that token pool is not drained of additional tokens from other games when multiple games of the same token are running concurrently", async () => {
    assert(false);
  });

  it("simulate a game 100 times without error", async () => {
    assert(false);
  });
});

//TODO
