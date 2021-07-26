// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract RockPaperScissors is Ownable {
    mapping(string => mapping(string => uint)) resultTable;
    mapping(address => uint[]) matches;

    struct GameRoom {
        uint256 startTime;
        address player1;
        address player2;
        bytes32 player1Choice;
        bytes32 player2Choice;
        string player1RevealChoice;
        string player2RevealChoice;
        mapping(address => uint) deposit;
        uint totalDeposit;
        uint requireCredit;
        bool isEnd;
        address winner;
        mapping(address => bool) receivedReward;
    }


    struct GameRoomInfo {
        address player1;
        address player2;
        uint totalDeposit;
        uint requireCredit;
        uint player1Deposit;
        uint player2Deposit;
        bool isEnd;
        address winner;
    }

    GameRoom[] listGameRooms;

    function initResultTable() private
    {

        resultTable["rock"]["rock"] = 0;
        resultTable["rock"]["paper"] = 2;
        resultTable["rock"]["scissors"] = 1;
        resultTable["paper"]["rock"] = 1;
        resultTable["paper"]["paper"] = 0;
        resultTable["paper"]["scissors"] = 2;
        resultTable["scissors"]["rock"] = 2;
        resultTable["scissors"]["paper"] = 1;
        resultTable["scissors"]["scissors"] = 0;
    }

    // if anyoneCanJoin set player2 = address(0)
    function createGame(uint credit, address invitePlayer) external payable {
        require(msg.value >= credit, "Must send ether credit when start new game!");
        GameRoom storage newGame = listGameRooms.push();
        newGame.startTime = block.timestamp;
        newGame.player1 = msg.sender;
        newGame.player2 = invitePlayer;
        newGame.requireCredit = credit;
        newGame.totalDeposit = msg.value;
        newGame.player1Choice = "";
        newGame.player2Choice = "";
        newGame.isEnd = false;
        newGame.winner = address(0);
        newGame.deposit[msg.sender] = msg.value;
        uint[] storage user_matches = matches[msg.sender];
        user_matches.push(listGameRooms.length - 1);
        //        return listGameRooms.length - 1;
    }

    function getListGame() public view returns (uint[] memory){
        return matches[msg.sender];
    }

    function joinGame(uint gameId) external payable {
        GameRoom storage selectedGame = listGameRooms[gameId];
        require(msg.value >= selectedGame.requireCredit, "Credit is not enough");
        require(!selectedGame.isEnd, "Game ended!");

        if (selectedGame.player2 == address(0) && selectedGame.player1 != msg.sender) {
            selectedGame.player2 = msg.sender;
            selectedGame.deposit[msg.sender] = msg.value;
            selectedGame.totalDeposit += msg.value;
        } else if (selectedGame.player2 == msg.sender) {
            selectedGame.deposit[msg.sender] = msg.value;
            selectedGame.totalDeposit += msg.value;
        } else {
            revert("Room is full!");
        }
    }

    function isNullChoice(string memory choice) private pure returns (bool){
        return bytes(choice).length <= 0;
    }

    function isNullBytes(bytes32 choice) private pure returns (bool){
        return choice == 0;
    }


    function isEqual(string memory a, string memory b) internal pure returns (bool){
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }


    // send encrypt move to reveal later
    function sendMove(uint gameId, bytes32 move) external {
        GameRoom storage selectedGame = listGameRooms[gameId];
        require(!selectedGame.isEnd, "Game ended!");
        require(msg.sender == selectedGame.player1 || msg.sender == selectedGame.player2, "Player must be in room");
        require(selectedGame.deposit[msg.sender] >= selectedGame.requireCredit, "Require to join game!");

        if (msg.sender == selectedGame.player1 && isNullBytes(selectedGame.player1Choice)) {
            //            console.log("move 1 send:");
            //            console.logBytes32(move);
            selectedGame.player1Choice = move;
        }
        if (msg.sender == selectedGame.player2 && isNullBytes(selectedGame.player2Choice)) {
            //            console.log("move 2 send:");
            //            console.logBytes32(move);
            selectedGame.player2Choice = move;
        }
    }

    function revealMove(uint gameId, string calldata move, string calldata salt) external {
        require(isEqual(move, "rock") || isEqual(move, "paper") || isEqual(move, "scissors"), "Invalid move");

        GameRoom storage selectedGame = listGameRooms[gameId];
        require(!selectedGame.isEnd, "Game ended!");
        require(msg.sender == selectedGame.player1 || msg.sender == selectedGame.player2, "Player must be in room");
        require(!isNullBytes(selectedGame.player1Choice) && !isNullBytes(selectedGame.player2Choice), "Two player must make choice first");

        bytes32 revealedHash = keccak256(abi.encodePacked(move, salt));
        //        console.log("Check Hash:");
        //        console.logBytes32(revealedHash);
        if (msg.sender == selectedGame.player1) {
            require(revealedHash == selectedGame.player1Choice, "Move is not valid");
            selectedGame.player1RevealChoice = move;
            checkGameResult(gameId);
        } else if (msg.sender == selectedGame.player2) {
            require(revealedHash == selectedGame.player2Choice, "Move is not valid");
            selectedGame.player2RevealChoice = move;
            checkGameResult(gameId);
        }

    }

    function checkGameResult(uint gameId) private {
        GameRoom storage selectedGame = listGameRooms[gameId];
        if (selectedGame.isEnd) return;
        if (isNullChoice(selectedGame.player1RevealChoice) || isNullChoice(selectedGame.player2RevealChoice)) return;
        initResultTable();
        uint result = resultTable[selectedGame.player1RevealChoice][selectedGame.player2RevealChoice];

        if (result == 0) {
            // tie
            selectedGame.isEnd = true;
            selectedGame.winner = address(0);
        } else if (result == 1) {
            selectedGame.isEnd = true;
            selectedGame.winner = selectedGame.player1;
        } else if (result == 2) {
            selectedGame.isEnd = true;
            selectedGame.winner = selectedGame.player2;
        }
    }

    function isGameEnd(uint gameId) external view returns (bool){
        GameRoom storage selectedGame = listGameRooms[gameId];
        return selectedGame.isEnd;
    }

    function getWinner(uint gameId) external view returns (address){
        GameRoom storage selectedGame = listGameRooms[gameId];
        return selectedGame.winner;
    }

    function getGameInfo(uint gameId) external view returns (GameRoomInfo memory){
        GameRoom storage selectedGame = listGameRooms[gameId];
        return GameRoomInfo(
            selectedGame.player1,
            selectedGame.player2,
            selectedGame.totalDeposit,
            selectedGame.requireCredit,
            selectedGame.deposit[selectedGame.player1],
            selectedGame.deposit[selectedGame.player2],
            selectedGame.isEnd,
            selectedGame.winner);
    }

    function withdraw(uint gameId) external {
        GameRoom storage selectedGame = listGameRooms[gameId];
        require(selectedGame.isEnd, "Game is not ended!");
        if (selectedGame.winner != address(0)) {
            require(msg.sender == selectedGame.winner, "You are not winner");
            require(!selectedGame.receivedReward[msg.sender], "Already withdraw!");
            payable(msg.sender).transfer(selectedGame.totalDeposit);
            selectedGame.receivedReward[msg.sender] = true;
        } else {
            require(msg.sender == selectedGame.player1 || msg.sender == selectedGame.player2, "You are not in room");
            require(!selectedGame.receivedReward[msg.sender], "Already withdraw!");
            payable(msg.sender).transfer(selectedGame.deposit[msg.sender]);
            selectedGame.receivedReward[msg.sender] = true;
        }
    }

    // request end game early if one player is not co-operate
    function requestEndGameEarly(uint gameId) external {
        GameRoom storage selectedGame = listGameRooms[gameId];
        require(msg.sender == selectedGame.player1 || msg.sender == selectedGame.player2);
        require(!selectedGame.isEnd, "Game ended!");
        require(block.timestamp - selectedGame.startTime > 1 hours, "Require time from created greater than 1 hour to end game early");

        // make this a tie game so anyone can withdraw amount they bet
        selectedGame.isEnd = true;
        selectedGame.winner = address(0);
        // any player can withdraw later with withdraw function;
    }

    function restartMatchWithCredit(uint fromGameId) external {
        GameRoom storage selectedGame = listGameRooms[fromGameId];
        require(selectedGame.isEnd, "Game not ended!");
        require(msg.sender == selectedGame.player1 || msg.sender == selectedGame.player2);
        require(!selectedGame.receivedReward[selectedGame.player1] &&
        !selectedGame.receivedReward[selectedGame.player2], "Require deposit not moved"
        );
        if (selectedGame.winner == msg.sender) {
            // winner restart game
            GameRoom storage newGame = listGameRooms.push();
            newGame.startTime = block.timestamp;
            newGame.player1 = selectedGame.player1;
            newGame.player2 = selectedGame.player2;
            newGame.requireCredit = selectedGame.totalDeposit;
            newGame.totalDeposit = selectedGame.totalDeposit;
            newGame.player1Choice = "";
            newGame.player2Choice = "";
            newGame.isEnd = false;
            newGame.winner = address(0);
            newGame.deposit[msg.sender] = selectedGame.totalDeposit;

            selectedGame.receivedReward[selectedGame.player1] = true;
            selectedGame.receivedReward[selectedGame.player2] = true;

            uint[] storage user_matches = matches[msg.sender];
            user_matches.push(listGameRooms.length - 1);


        } else if (selectedGame.winner == address(0)) {
            // tie game
            GameRoom storage newGame = listGameRooms.push();
            newGame.startTime = block.timestamp;
            newGame.player1 = selectedGame.player1;
            newGame.player2 = selectedGame.player2;
            newGame.requireCredit = selectedGame.requireCredit;
            newGame.totalDeposit = selectedGame.totalDeposit;
            newGame.player1Choice = "";
            newGame.player2Choice = "";
            newGame.isEnd = false;
            newGame.winner = address(0);
            newGame.deposit[selectedGame.player1] = selectedGame.deposit[selectedGame.player1];
            newGame.deposit[selectedGame.player2] = selectedGame.deposit[selectedGame.player2];


            selectedGame.receivedReward[selectedGame.player1] = true;
            selectedGame.receivedReward[selectedGame.player2] = true;

            uint[] storage user_matches = matches[msg.sender];
            user_matches.push(listGameRooms.length - 1);
        } else {
            revert("You can not restart this game!");
        }
    }

}
