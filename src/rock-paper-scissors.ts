import { loadStdlib } from "@reach-sh/stdlib";
import algosdk from "algosdk";
// @ts-ignore TypeScript cannot import .mjs files
import * as backend from "../build/rock-paper-scissors.main.mjs";

async function configureStdlib() {
  const stdlib = await loadStdlib();

  // NOTE: this should not be needed with the next release of @reach-sh/stdlib
  stdlib.setAlgodClient(
    Promise.resolve(
      new algosdk.Algodv2(
        {
          "X-API-Key": process.env.ALGO_TOKEN!,
        },
        process.env.ALGO_SERVER,
        process.env.ALGO_PORT
      )
    )
  );

  stdlib.setIndexer(
    Promise.resolve(
      new algosdk.Indexer(
        {
          "X-API-Key": process.env.ALGO_INDEXER_TOKEN!,
        },
        process.env.ALGO_INDEXER_SERVER,
        process.env.ALGO_INDEXER_PORT
      )
    )
  );

  return stdlib;
}

async function main() {
  const stdlib = await configureStdlib();
  // const startingBalance = stdlib.parseCurrency(10);
  // const accAlice = await stdlib.newTestAccount(startingBalance);
  // const accBob = await stdlib.newTestAccount(startingBalance);

  // NOTE: will need to manually dispense Algos to these accounts
  // https://bank.testnet.algorand.network/
  const skAlice = algosdk.mnemonicToSecretKey(process.env.ALICE_MNEMONIC!);
  const skBob = algosdk.mnemonicToSecretKey(process.env.BOB_MNEMONIC!);
  const accAlice = await stdlib.connectAccount(skAlice);
  const accBob = await stdlib.connectAccount(skBob);

  const fmt = (x: number) => stdlib.formatCurrency(x, 4);
  const getBalance = async (who: string) => fmt(await stdlib.balanceOf(who));
  const beforeAlice = await getBalance(accAlice);
  const beforeBob = await getBalance(accBob);

  const ctcAlice = accAlice.deploy(backend);
  const ctcBob = accBob.attach(backend, ctcAlice.getInfo());

  // console.log("info", await ctcAlice.getInfo());

  const HAND = ["Rock", "Paper", "Scissors"];
  const OUTCOME = ["Bob wins", "Draw", "Alice wins"];
  const Player = (Who: string) => ({
    ...stdlib.hasRandom,
    getHand: async () => {
      // <-- async now
      const hand = Math.floor(Math.random() * 3);
      console.log(`${Who} played ${HAND[hand]}`);
      if (Math.random() <= 0.01) {
        for (let i = 0; i < 10; i++) {
          console.log(`  ${Who} takes their sweet time sending it back...`);
          await stdlib.wait(1);
        }
      }
      return hand;
    },
    seeOutcome: (outcome: number) => {
      console.log(`${Who} saw outcome ${OUTCOME[outcome]}`);
    },
    informTimeout: () => {
      console.log(`${Who} observed a timeout`);
    },
  });

  await Promise.all([
    backend.Alice(ctcAlice, {
      ...Player("Alice"),
      wager: stdlib.parseCurrency(5),
    }),
    backend.Bob(ctcBob, {
      ...Player("Bob"),
      acceptWager: (amt: number) => {
        console.log(`Bob accepts the wager of ${fmt(amt)}.`);
      },
    }),
  ]);

  const afterAlice = await getBalance(accAlice);
  const afterBob = await getBalance(accBob);

  console.log(`Alice went from ${beforeAlice} to ${afterAlice}.`);
  console.log(`Bob went from ${beforeBob} to ${afterBob}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
