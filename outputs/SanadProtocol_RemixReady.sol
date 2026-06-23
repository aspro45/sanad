// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library SafeToken {
    error TokenTransferFailed();

    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(token.transfer.selector, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TokenTransferFailed();
        }
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(token.transferFrom.selector, from, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TokenTransferFailed();
        }
    }
}

contract SanadProtocol {
    using SafeToken for IERC20;

    enum RequestStatus {
        Submitted,
        Verified,
        Funded,
        Paid,
        Rejected,
        Cancelled,
        Refunded
    }

    struct AidRequest {
        address beneficiary;
        address provider;
        address verifier;
        address token;
        uint256 requestedAmount;
        uint256 fundedAmount;
        uint256 createdAt;
        uint256 deadline;
        bytes32 category;
        bytes32 metadataHash;
        bytes32 verificationHash;
        bytes32 memoId;
        RequestStatus status;
    }

    error NotOwner();
    error NotVerifier();
    error NotProvider();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidStatus();
    error DeadlinePassed();
    error NotExpired();
    error TransferLocked();
    error InvalidRequest();
    error InvalidHash();
    error Paused();
    error TokenNotApproved();
    error RequestTooLarge();

    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PausedUpdated(bool paused);
    event VerifierUpdated(address indexed verifier, bool approved);
    event ProviderUpdated(address indexed provider, bool approved);
    event TokenUpdated(address indexed token, bool approved, uint256 maxRequestAmount);
    event RequestSubmitted(uint256 indexed requestId, address indexed beneficiary, address indexed provider);
    event RequestVerified(
        uint256 indexed requestId,
        address indexed verifier,
        bytes32 verificationHash
    );
    event RequestRejected(
        uint256 indexed requestId,
        address indexed verifier,
        bytes32 reasonHash
    );
    event RequestFunded(uint256 indexed requestId, address indexed donor, uint256 amount);
    event RequestPaid(uint256 indexed requestId, address indexed provider, uint256 amount);
    event RequestCancelled(uint256 indexed requestId, address indexed beneficiary);
    event RequestRefunded(uint256 indexed requestId, address indexed recipient, uint256 amount);

    address public owner;
    address public pendingOwner;
    uint256 public requestCount;
    uint256 public constant MIN_DEADLINE_DELAY = 1 hours;
    uint256 public constant MAX_DEADLINE_DELAY = 90 days;
    bool public paused;
    bool private locked;

    mapping(address => bool) public approvedVerifiers;
    mapping(address => bool) public approvedProviders;
    mapping(address => bool) public approvedTokens;
    mapping(address => uint256) public tokenMaxRequestAmount;
    mapping(uint256 => AidRequest) private requests;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyVerifier() {
        if (!approvedVerifiers[msg.sender]) revert NotVerifier();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert TransferLocked();
        locked = true;
        _;
        locked = false;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function setPaused(bool shouldPause) external onlyOwner {
        paused = shouldPause;
        emit PausedUpdated(shouldPause);
    }

    function setVerifier(address verifier, bool approved) external onlyOwner {
        if (verifier == address(0)) revert InvalidAddress();
        approvedVerifiers[verifier] = approved;
        emit VerifierUpdated(verifier, approved);
    }

    function setProvider(address provider, bool approved) external onlyOwner {
        if (provider == address(0)) revert InvalidAddress();
        approvedProviders[provider] = approved;
        emit ProviderUpdated(provider, approved);
    }

    function setToken(address token, bool approved, uint256 maxRequestAmount) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        if (approved && maxRequestAmount == 0) revert InvalidAmount();
        approvedTokens[token] = approved;
        tokenMaxRequestAmount[token] = approved ? maxRequestAmount : 0;
        emit TokenUpdated(token, approved, approved ? maxRequestAmount : 0);
    }

    function submitRequest(
        address provider,
        address token,
        uint256 amount,
        bytes32 category,
        bytes32 metadataHash,
        bytes32 memoId,
        uint256 deadline
    ) external whenNotPaused returns (uint256 requestId) {
        if (!approvedProviders[provider]) revert NotProvider();
        if (!approvedTokens[token]) revert TokenNotApproved();
        if (amount == 0) revert InvalidAmount();
        if (amount > tokenMaxRequestAmount[token]) revert RequestTooLarge();
        if (category == bytes32(0) || metadataHash == bytes32(0) || memoId == bytes32(0)) revert InvalidHash();
        if (
            deadline < block.timestamp + MIN_DEADLINE_DELAY ||
            deadline > block.timestamp + MAX_DEADLINE_DELAY
        ) revert InvalidDeadline();

        requestId = ++requestCount;
        requests[requestId] = AidRequest({
            beneficiary: msg.sender,
            provider: provider,
            verifier: address(0),
            token: token,
            requestedAmount: amount,
            fundedAmount: 0,
            createdAt: block.timestamp,
            deadline: deadline,
            category: category,
            metadataHash: metadataHash,
            verificationHash: bytes32(0),
            memoId: memoId,
            status: RequestStatus.Submitted
        });

        emit RequestSubmitted(requestId, msg.sender, provider);
    }

    function verifyRequest(uint256 requestId, bytes32 verificationHash) external onlyVerifier whenNotPaused {
        AidRequest storage aidRequest = requests[requestId];
        _requireRequest(aidRequest);
        if (aidRequest.status != RequestStatus.Submitted) revert InvalidStatus();
        if (block.timestamp > aidRequest.deadline) revert DeadlinePassed();
        if (verificationHash == bytes32(0)) revert InvalidHash();

        aidRequest.verifier = msg.sender;
        aidRequest.verificationHash = verificationHash;
        aidRequest.status = RequestStatus.Verified;

        emit RequestVerified(requestId, msg.sender, verificationHash);
    }

    function rejectRequest(uint256 requestId, bytes32 reasonHash) external onlyVerifier whenNotPaused {
        AidRequest storage aidRequest = requests[requestId];
        _requireRequest(aidRequest);
        if (aidRequest.status != RequestStatus.Submitted) revert InvalidStatus();
        if (reasonHash == bytes32(0)) revert InvalidHash();

        aidRequest.verifier = msg.sender;
        aidRequest.status = RequestStatus.Rejected;

        emit RequestRejected(requestId, msg.sender, reasonHash);
    }

    function fundRequest(uint256 requestId, uint256 amount) external nonReentrant whenNotPaused {
        AidRequest storage aidRequest = requests[requestId];
        _requireRequest(aidRequest);
        if (
            aidRequest.status != RequestStatus.Verified &&
            aidRequest.status != RequestStatus.Funded
        ) revert InvalidStatus();
        if (block.timestamp > aidRequest.deadline) revert DeadlinePassed();
        if (amount == 0) revert InvalidAmount();

        uint256 remaining = aidRequest.requestedAmount - aidRequest.fundedAmount;
        if (amount > remaining) revert InvalidAmount();

        IERC20(aidRequest.token).safeTransferFrom(msg.sender, address(this), amount);
        aidRequest.fundedAmount += amount;
        contributions[requestId][msg.sender] += amount;

        if (aidRequest.fundedAmount == aidRequest.requestedAmount) {
            aidRequest.status = RequestStatus.Funded;
        }

        emit RequestFunded(requestId, msg.sender, amount);
    }

    function payProvider(uint256 requestId) external nonReentrant whenNotPaused {
        AidRequest storage aidRequest = requests[requestId];
        _requireRequest(aidRequest);
        if (aidRequest.status != RequestStatus.Funded) revert InvalidStatus();
        if (
            msg.sender != aidRequest.beneficiary &&
            msg.sender != aidRequest.provider &&
            !approvedVerifiers[msg.sender]
        ) revert InvalidStatus();

        uint256 payoutAmount = aidRequest.fundedAmount;
        aidRequest.status = RequestStatus.Paid;
        IERC20(aidRequest.token).safeTransfer(aidRequest.provider, payoutAmount);

        emit RequestPaid(requestId, aidRequest.provider, payoutAmount);
    }

    function cancelRequest(uint256 requestId) external whenNotPaused {
        AidRequest storage aidRequest = requests[requestId];
        _requireRequest(aidRequest);
        if (msg.sender != aidRequest.beneficiary) revert InvalidStatus();
        if (aidRequest.status != RequestStatus.Submitted) revert InvalidStatus();

        aidRequest.status = RequestStatus.Cancelled;
        emit RequestCancelled(requestId, msg.sender);
    }

    function refundExpired(uint256 requestId) external nonReentrant {
        AidRequest storage aidRequest = requests[requestId];
        _requireRequest(aidRequest);
        if (block.timestamp <= aidRequest.deadline) revert NotExpired();
        if (
            aidRequest.status != RequestStatus.Verified &&
            aidRequest.status != RequestStatus.Funded
        ) revert InvalidStatus();

        uint256 contribution = contributions[requestId][msg.sender];
        if (contribution == 0) revert InvalidAmount();

        contributions[requestId][msg.sender] = 0;
        aidRequest.fundedAmount -= contribution;
        IERC20(aidRequest.token).safeTransfer(msg.sender, contribution);

        if (aidRequest.fundedAmount == 0) {
            aidRequest.status = RequestStatus.Refunded;
        } else if (aidRequest.fundedAmount < aidRequest.requestedAmount) {
            aidRequest.status = RequestStatus.Verified;
        }

        emit RequestRefunded(requestId, msg.sender, contribution);
    }

    function getRequestCore(
        uint256 requestId
    )
        external
        view
        returns (
            address beneficiary,
            address provider,
            address verifier,
            address token,
            uint256 requestedAmount,
            uint256 fundedAmount,
            uint256 deadline,
            uint8 status
        )
    {
        AidRequest storage aidRequest = requests[requestId];
        _requireRequest(aidRequest);
        return (
            aidRequest.beneficiary,
            aidRequest.provider,
            aidRequest.verifier,
            aidRequest.token,
            aidRequest.requestedAmount,
            aidRequest.fundedAmount,
            aidRequest.deadline,
            uint8(aidRequest.status)
        );
    }

    function getRequestProof(
        uint256 requestId
    )
        external
        view
        returns (
            uint256 createdAt,
            bytes32 category,
            bytes32 metadataHash,
            bytes32 verificationHash,
            bytes32 memoId
        )
    {
        AidRequest storage aidRequest = requests[requestId];
        _requireRequest(aidRequest);
        return (
            aidRequest.createdAt,
            aidRequest.category,
            aidRequest.metadataHash,
            aidRequest.verificationHash,
            aidRequest.memoId
        );
    }

    function _requireRequest(AidRequest storage aidRequest) private view {
        if (aidRequest.beneficiary == address(0)) revert InvalidRequest();
    }
}
