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

			describe("constructor", async () => {
				it("initializes the raffle correctly", async () => {
					const raffleState = await raffle.getRaffleState();
					assert.equal(raffleState, 0);
					assert.equal(interval, networkConfig[chainId].interval);
				});
			});

			describe("enter raffle", async () => {
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
	  });
