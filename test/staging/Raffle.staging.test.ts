import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { network, getNamedAccounts, deployments, ethers } from "hardhat";
import { developmentChains, networkConfig } from "../../helper-hardhat-config";
import { Raffle } from "../../typechain-types";

developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle Staging Tests", async () => {
			let raffle: Raffle, entranceFee: BigNumber, deployer;
			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer;
				raffle = await ethers.getContract("Raffle", deployer);
				entranceFee = await raffle.getEntranceFee();
			});
			describe("fullfillRandomWords", () => {
				it("works with live Chainlink Keepers and Chainlink VRF,we get a random winner", async () => {
					// enter the raffle
					const startingTimeStamp = await raffle.getLatestTimeStamp();
					const accounts = await ethers.getSigners();
					await new Promise<void>(async (resolve, reject) => {
						raffle.once("WinnerPicked", async () => {
							console.log("WinnerPicked event emitted");
							try {
								const recentWinner = await raffle.getRecentWinner();
								const raffleState = await raffle.getRaffleState();
								const winnerEndingBalance = await accounts[0].getBalance();
								const endingTimeStamp = await raffle.getLatestTimeStamp();

								await expect(raffle.getPlayers(0)).to.be.reverted;
								assert.equal(recentWinner.toString(), accounts[0].address);
								assert.equal(raffleState, 0);
								assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(entranceFee).toString());
								assert(endingTimeStamp.gt(startingTimeStamp));
								resolve();
							} catch (error) {
								console.log("error :>> ", error);
								reject(error);
							}
						});

						await raffle.enterRaffle({ value: entranceFee });
						const winnerStartingBalance = await accounts[0].getBalance();
					});
				});
			});
	  });
