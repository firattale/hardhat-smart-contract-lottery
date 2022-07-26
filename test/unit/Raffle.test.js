const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle Unit Tests", async () => {
			let raffle, vrfCoordinatorV2Mock, entranceFee, deployer, interval;
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
					assert.equal(interval, networkConfig[chainId].interval);
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
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
					assert(!upkeepNeeded);
				});
				it("returns false if raffle is not open", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					// we pretend to be a chainlink keeper
					await raffle.performUpkeep([]);
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
					const raffleState = await raffle.getRaffleState();
					assert.equal(raffleState, 1);
					assert(!upkeepNeeded);
				});
				it("returns false if enough time hasn't passed", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]);
					await network.provider.request({ method: "evm_mine", params: [] });
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
					assert(!upkeepNeeded);
				});
				it("returns true if enough time has passed, has players, eth, and is open", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.request({ method: "evm_mine", params: [] });
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
					expect(upkeepNeeded, true);
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
				it.only("updates the state, emits an event and calls the vrf coordinator ", async () => {
					await raffle.enterRaffle({ value: entranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					const txResponse = await raffle.performUpkeep([]);
					const txReceipt = await txResponse.wait(1);
					const { requestId } = txReceipt.events[1].args;
					const raffleState = await raffle.getRaffleState();
					assert(requestId.toNumber() > 0);
					assert(raffleState === 1);
				});
			});
	  });
