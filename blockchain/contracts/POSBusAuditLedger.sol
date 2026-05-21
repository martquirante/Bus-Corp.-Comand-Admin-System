// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract POSBusAuditLedger {
    address public owner;

    struct AuditRecord {
        string recordHash;
        string metadataHash;
        uint256 blockTimestamp;
        address anchorSender;
        bool exists;
    }

    // Maps recordType => recordId => AuditRecord
    mapping(string => mapping(string => AuditRecord)) private auditRegistry;

    // Events
    event AuditStored(
        string indexed recordType,
        string indexed recordId,
        string recordHash,
        string metadataHash,
        uint256 timestamp,
        address indexed anchorSender
    );

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "POSBusAuditLedger: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);
    }

    /**
     * @dev Stores a new audit hash proof. Can only be done by the contract owner (the backend).
     */
    function storeAuditHash(
        string calldata recordType,
        string calldata recordId,
        string calldata recordHash,
        string calldata metadataHash
    ) external onlyOwner {
        require(bytes(recordType).length > 0, "POSBusAuditLedger: recordType cannot be empty");
        require(bytes(recordId).length > 0, "POSBusAuditLedger: recordId cannot be empty");
        require(bytes(recordHash).length > 0, "POSBusAuditLedger: recordHash cannot be empty");

        auditRegistry[recordType][recordId] = AuditRecord({
            recordHash: recordHash,
            metadataHash: metadataHash,
            blockTimestamp: block.timestamp,
            anchorSender: msg.sender,
            exists: true
        });

        emit AuditStored(
            recordType,
            recordId,
            recordHash,
            metadataHash,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @dev Verifies if a given record hash proof matches the on-chain recorded hash.
     */
    function verifyAuditHash(
        string calldata recordType,
        string calldata recordId,
        string calldata recordHash
    ) external view returns (bool) {
        AuditRecord memory record = auditRegistry[recordType][recordId];
        if (!record.exists) {
            return false;
        }
        return keccak256(bytes(record.recordHash)) == keccak256(bytes(recordHash));
    }

    /**
     * @dev Retrieves audit record details.
     */
    function getAudit(
        string calldata recordType,
        string calldata recordId
    ) external view returns (
        string memory recordHash,
        string memory metadataHash,
        uint256 blockTimestamp,
        address anchorSender
    ) {
        AuditRecord memory record = auditRegistry[recordType][recordId];
        require(record.exists, "POSBusAuditLedger: audit record not found");
        return (
            record.recordHash,
            record.metadataHash,
            record.blockTimestamp,
            record.anchorSender
        );
    }

    /**
     * @dev Allows owner to transfer ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "POSBusAuditLedger: new owner is zero address");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }
}
