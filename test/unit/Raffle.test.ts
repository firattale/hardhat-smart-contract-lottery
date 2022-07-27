import { BigNumber } from "ethers";
import { assert, expect } from "chai";
import { network, getNamedAccounts, deployments, ethers } from "hardhat";
import { developmentChains, networkConfig } from "../../helper-hardhat-config";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";

!developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle Unit Tests", async () => {
			let raffle: Raffle,
				vrfCoordinatorV2Mock: VRFCoordinatorV2Mock,
				entranceFee: BigNumber,
				deployer: string,
				interval: BigNumber;
			const { chainId } = network.config;
			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer;
				await deployments.fixture(["all"]);
				raffle = await ethers.getContract("Raffle", deployer);
				entranceFee = await raffle.getEntranceFee();
				interval = await raffle.getInterval();
				vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
			});

			describe("constructor", () => {
				it("initializes the raffle correctly", async () => {
					const raffleState = await raffle.getRaffleState();
					assert.equal(raffleState, 0);
					assert.equal(interval.toString(), networkConfig[chainId!].interval);
				});
			});

			describe("enter raffle", () => {
				it("reverts when you dont pay enough ", async () => {
					await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEthEntered");
				});
				it("records players when they enter", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					const player = await raffle.getPlayers(0);
					assert.equal(player, deployer);
				});
				it("emits event on enter", async () => {
					await expect(raffle.enterRaffle({ value: entranceFee }))
						.to.emit(raffle, "RaffleEnter")
						.withArgs(deployer);
				});
				it("doesnt allow raffle when it is calculating", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					// we pretend to be a chainlink keeper
					await raffle.performUpkeep([]);
					await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith("Raffle__NotOpen");
				});
			});
			describe("checkUpkeep", () => {
				it("returns false if people havent sent any ETH", async () => {
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
					assert(!upKeepNeeded);
				});
				it("returns false if raffle is not open", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					// we pretend to be a chainlink keeper
					await raffle.performUpkeep([]);
					const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
					const raffleState = await raffle.getRaffleState();
					assert.equal(raffleState, 1);
					assert(!upKeepNeeded);
				});
				it("returns false if enough time hasn't passed", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]);
					await network.provider.request({ method: "evm_mine", params: [] });
					const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
					assert(!upKeepNeeded);
				});
				it("returns true if enough time has passed, has players, eth, and is open", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.request({ method: "evm_mine", params: [] });
					const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
					assert(upKeepNeeded);
				});
			});
			describe("performUpkeep", () => {
				it("can only run if checkUpkeep is true ", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					const tx = await raffle.performUpkeep([]);
					assert(tx);
				});
				it("reverts if checkUpkeep is false", async () => {
					await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded");
				});
				it("updates the state, emits an event and calls the vrf coordinator ", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					const txResponse = await raffle.performUpkeep([]);
					const txReceipt = await txResponse.wait(1);
					const requestId = txReceipt!.events![1].args!.requestId;
					const raffleState = await raffle.getRaffleState();
					assert(requestId.toNumber() > 0);
					assert(raffleState === 1);
				});
			});
			describe("fullfillRandomWords", () => {
				beforeEach(async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
				});
				it("can only be called after performUpkeep ", async () => {
					await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith(
						"nonexistent request"
					);
					await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith(
						"nonexistent request"
					);
				});
				it("picks a winner, resets the lottery and sends the money", async () => {
					const additionalEntrants = 3;
					const startingAccountIndex = 1; // deployer is 0
					const accounts = await ethers.getSigners();
					for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
						const accountConnectedRaffle = await raffle.connect(accounts[i]);
						await accountConnectedRaffle.enterRaffle({ value: entranceFee });
					}
					const startingTimeStamp = await raffle.getLatestTimeStamp();
					// performUpkeep(mock being Chainlink Keepers)
					// fulfillRandomWords(mock being Chainlink VRF)
					// We will have to wait for the fullfilledRandomWords to be called
					await new Promise<void>(async (resolve, reject) => {
						raffle.once("WinnerPicked", async () => {
							console.log("Found the event");
							try {
								const raffleState = await raffle.getRaffleState();
								const endingTimeStamp = await raffle.getLatestTimeStamp();
								const numPlayers = await raffle.getNumberOfPlayers();
								// account 1 is winner
								const winningEndingBalance = await accounts[1].getBalance();
								assert.equal(numPlayers.toString(), "0");
								assert.equal(raffleState, 0);
								assert(endingTimeStamp > startingTimeStamp);
								assert.equal(
									winningEndingBalance.toString(),
									winningStartingBalance.add(entranceFee.mul(additionalEntrants).add(entranceFee)).toString()
								);
							} catch (e) {
								reject(e);
							}
							resolve();
						});
						const tx = await raffle.performUpkeep([]);
						const txReceipt = await tx.wait(1);
						const winningStartingBalance = await accounts[1].getBalance();
						await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt!.events![1].args!.requestId, raffle.address);
					});
				});
			});
	  });
