const {expect} = require("chai");
const one_eth = ethers.utils.parseEther("1.0");


function encodeMove(move, salt) {
    let encodeAbi = ethers.utils.solidityKeccak256(["string", "string"], [move, salt]);
    return encodeAbi;
    // return ethers.utils.parseBytes32String(encodeAbi);
    // let messageHashBinary = ethers.utils.arrayify(encodeAbi);
    // return messageHashBinary;
}

describe("RockPaperScissors", function () {
    let contract;
    let owner, player1, player2;
    beforeEach(async function () {
        [owner, player1, player2, player3] = await ethers.getSigners();
        const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
        contract = await RockPaperScissors.deploy();
        await contract.deployed();
    });

    it("normal game success", async function () {
        let userContract1 = await contract.connect(player1);
        let userContract2 = await contract.connect(player2);


        let tx1 = await userContract1.createGame(one_eth, ethers.constants.AddressZero, {value: one_eth});
        await tx1.wait();
        let listGame = await userContract1.getListGame();
        expect(listGame.length).to.be.equal(1);
        expect(listGame[0].toString()).to.be.equal("0");

        let gameId = listGame[0];
        let balanceContract = await ethers.provider.getBalance(contract.address);
        expect(balanceContract).to.be.equal(one_eth);


        let tx2 = await userContract2.joinGame(gameId, {value: one_eth});
        await tx2.wait();

        // move hash: keccak256(abi.encodePacked(move, salt));
        let player1Move = encodeMove("paper", "player1");
        let tx3 = await userContract1.sendMove(gameId, player1Move);
        await tx3;

        let player2Move = encodeMove("rock", "player2");
        let tx4 = await userContract2.sendMove(gameId, player2Move);
        await tx4;

        let tx5 = await userContract1.revealMove(gameId, "paper", "player1");
        await tx5;

        let tx6 = await userContract2.revealMove(gameId, "rock", "player2");
        await tx6;

        let isGameEnd = await userContract1.isGameEnd(gameId);
        expect(isGameEnd).to.be.equal(true);
        let winner = await userContract1.getWinner(gameId);
        expect(winner).to.be.equal(player1.address);

        await expect(
            userContract1.withdraw(gameId)
        ).to.be.satisfy;


        await expect(
            userContract2.withdraw(gameId)
        ).to.be.reverted;
    });


    it("tie game success", async function () {
        let userContract1 = await contract.connect(player1);
        let userContract2 = await contract.connect(player2);


        let tx1 = await userContract1.createGame(one_eth, ethers.constants.AddressZero, {value: one_eth});
        await tx1.wait();
        let listGame = await userContract1.getListGame();
        expect(listGame.length).to.be.equal(1);
        expect(listGame[0].toString()).to.be.equal("0");

        let gameId = listGame[0];
        let balanceContract = await ethers.provider.getBalance(contract.address);
        expect(balanceContract).to.be.equal(one_eth);


        let tx2 = await userContract2.joinGame(gameId, {value: one_eth});
        await tx2.wait();

        // move hash: keccak256(abi.encodePacked(move, salt));
        let player1Move = encodeMove("paper", "player1");
        let tx3 = await userContract1.sendMove(gameId, player1Move);
        await tx3;

        let player2Move = encodeMove("paper", "player2");
        let tx4 = await userContract2.sendMove(gameId, player2Move);
        await tx4;

        let tx5 = await userContract1.revealMove(gameId, "paper", "player1");
        await tx5;

        let tx6 = await userContract2.revealMove(gameId, "paper", "player2");
        await tx6;

        let isGameEnd = await userContract1.isGameEnd(gameId);
        expect(isGameEnd).to.be.equal(true);
        let winner = await userContract1.getWinner(gameId);
        expect(winner).to.be.equal(ethers.constants.AddressZero);

        await expect(
            userContract1.withdraw(gameId)
        ).to.be.satisfy;


        await expect(
            userContract2.withdraw(gameId)
        ).to.be.satisfy;
    });

    it("invited game", async function () {
        let userContract1 = await contract.connect(player1);
        let userContract2 = await contract.connect(player2);

        let tx1 = await userContract1.createGame(one_eth, player2.address, {value: one_eth});
        await tx1.wait();
        let listGame = await userContract1.getListGame();
        expect(listGame.length).to.be.equal(1);
        expect(listGame[0].toString()).to.be.equal("0");
        let gameId = listGame[0];

        let userContract3 = await contract.connect(player3);
        await expect(
            userContract3.joinGame(gameId, {value: one_eth})
        ).to.be.revertedWith("Room is full!");


        // invited player can join
        let tx2 = await userContract2.joinGame(gameId, {value: one_eth});
        await tx2.wait();

        // move hash: keccak256(abi.encodePacked(move, salt));
        let player1Move = encodeMove("paper", "player1");
        await expect(
            userContract1.sendMove(gameId, player1Move)
        ).to.be.satisfy;

        let player2Move = encodeMove("rock", "player2");
        await expect(
            userContract2.sendMove(gameId, player2Move)
        ).to.be.satisfy;

    });

    it("wrong move reveal", async function () {
        let userContract1 = await contract.connect(player1);
        let userContract2 = await contract.connect(player2);

        let tx1 = await userContract1.createGame(one_eth, player2.address, {value: one_eth});
        await tx1.wait();
        let listGame = await userContract1.getListGame();
        expect(listGame.length).to.be.equal(1);
        expect(listGame[0].toString()).to.be.equal("0");
        let gameId = listGame[0];

        let tx2 = await userContract2.joinGame(gameId, {value: one_eth});
        await tx2.wait();

        // two valid player can move
        // move hash: keccak256(abi.encodePacked(move, salt));
        let player1Move = encodeMove("paper", "player1");
        await expect(
            userContract1.sendMove(gameId, player1Move)
        ).to.be.satisfy;

        let player2Move = encodeMove("rock", "player2");
        await expect(
            userContract2.sendMove(gameId, player2Move)
        ).to.be.satisfy;

        await expect(
            userContract1.revealMove(gameId, "paper", "player2")
        ).to.be.reverted;


        await expect(
            userContract1.revealMove(gameId, "rock", "player1")
        ).to.be.reverted;

    });

    it("check withdraw multiple time", async function () {
        let userContract1 = await contract.connect(player1);
        let userContract2 = await contract.connect(player2);


        let tx1 = await userContract1.createGame(one_eth, ethers.constants.AddressZero, {value: one_eth});
        await tx1.wait();
        let listGame = await userContract1.getListGame();
        expect(listGame.length).to.be.equal(1);
        expect(listGame[0].toString()).to.be.equal("0");

        let gameId = listGame[0];
        let balanceContract = await ethers.provider.getBalance(contract.address);
        expect(balanceContract).to.be.equal(one_eth);


        let tx2 = await userContract2.joinGame(gameId, {value: one_eth});
        await tx2.wait();

        // move hash: keccak256(abi.encodePacked(move, salt));
        let player1Move = encodeMove("paper", "player1");
        let tx3 = await userContract1.sendMove(gameId, player1Move);
        await tx3;

        let player2Move = encodeMove("rock", "player2");
        let tx4 = await userContract2.sendMove(gameId, player2Move);
        await tx4;

        let tx5 = await userContract1.revealMove(gameId, "paper", "player1");
        await tx5;

        let tx6 = await userContract2.revealMove(gameId, "rock", "player2");
        await tx6;

        let isGameEnd = await userContract1.isGameEnd(gameId);
        expect(isGameEnd).to.be.equal(true);
        let winner = await userContract1.getWinner(gameId);
        expect(winner).to.be.equal(player1.address);

        await expect(
            userContract1.withdraw(gameId)
        ).to.be.satisfy;

        await expect(
            userContract1.withdraw(gameId)
        ).to.be.revertedWith("Already withdraw!");
    });

    it("restart game after withdraw", async function () {
        let userContract1 = await contract.connect(player1);
        let userContract2 = await contract.connect(player2);


        let tx1 = await userContract1.createGame(one_eth, ethers.constants.AddressZero, {value: one_eth});
        await tx1.wait();
        let listGame = await userContract1.getListGame();
        expect(listGame.length).to.be.equal(1);
        expect(listGame[0].toString()).to.be.equal("0");

        let gameId = listGame[0];
        let balanceContract = await ethers.provider.getBalance(contract.address);
        expect(balanceContract).to.be.equal(one_eth);


        let tx2 = await userContract2.joinGame(gameId, {value: one_eth});
        await tx2.wait();

        // move hash: keccak256(abi.encodePacked(move, salt));
        let player1Move = encodeMove("paper", "player1");
        let tx3 = await userContract1.sendMove(gameId, player1Move);
        await tx3;

        let player2Move = encodeMove("rock", "player2");
        let tx4 = await userContract2.sendMove(gameId, player2Move);
        await tx4;

        let tx5 = await userContract1.revealMove(gameId, "paper", "player1");
        await tx5;

        let tx6 = await userContract2.revealMove(gameId, "rock", "player2");
        await tx6;

        let isGameEnd = await userContract1.isGameEnd(gameId);
        expect(isGameEnd).to.be.equal(true);
        let winner = await userContract1.getWinner(gameId);
        expect(winner).to.be.equal(player1.address);

        await expect(
            userContract1.withdraw(gameId)
        ).to.be.satisfy;

        await expect(
           userContract1.restartMatchWithCredit(gameId)
        ).to.be.reverted;
    });


    it("restart game after success", async function () {
        let userContract1 = await contract.connect(player1);
        let userContract2 = await contract.connect(player2);


        let tx1 = await userContract1.createGame(one_eth, ethers.constants.AddressZero, {value: one_eth});
        await tx1.wait();
        let listGame = await userContract1.getListGame();
        expect(listGame.length).to.be.equal(1);
        expect(listGame[0].toString()).to.be.equal("0");

        let gameId = listGame[0];
        let balanceContract = await ethers.provider.getBalance(contract.address);
        expect(balanceContract).to.be.equal(one_eth);


        let tx2 = await userContract2.joinGame(gameId, {value: one_eth});
        await tx2.wait();

        // move hash: keccak256(abi.encodePacked(move, salt));
        let player1Move = encodeMove("paper", "player1");
        let tx3 = await userContract1.sendMove(gameId, player1Move);
        await tx3;

        let player2Move = encodeMove("rock", "player2");
        let tx4 = await userContract2.sendMove(gameId, player2Move);
        await tx4;

        let tx5 = await userContract1.revealMove(gameId, "paper", "player1");
        await tx5;

        let tx6 = await userContract2.revealMove(gameId, "rock", "player2");
        await tx6;

        let isGameEnd = await userContract1.isGameEnd(gameId);
        expect(isGameEnd).to.be.equal(true);
        let winner = await userContract1.getWinner(gameId);
        expect(winner).to.be.equal(player1.address);

        await expect(
            userContract1.restartMatchWithCredit(gameId)
        ).to.be.satisfy;

        listGame = await userContract1.getListGame();
        expect(listGame.length).to.be.equal(2);
        expect(listGame[1].toString()).to.be.equal("1");

        let gameInfo = await userContract1.getGameInfo(listGame[1]);
        console.log(gameInfo);
        expect(gameInfo.player1).to.be.equal(player1.address);
        expect(gameInfo.player2).to.be.equal(player2.address);
        expect(gameInfo.totalDeposit).to.be.equal(one_eth.mul(2));
        expect(gameInfo.requireCredit).to.be.equal(one_eth.mul(2));
        expect(gameInfo.player1Deposit).to.be.equal(one_eth.mul(2));
        expect(gameInfo.player2Deposit).to.be.equal(ethers.utils.parseEther("0.0"));


        await expect(
            userContract2.joinGame(gameId, {value: one_eth})
        ).to.be.reverted;

        await expect(
            userContract2.joinGame(gameId, {value: one_eth.mul(2)})
        ).to.be.satisfy;
    });



})
