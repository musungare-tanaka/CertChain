// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  CertificateRegistry
 * @author CertChain
 * @notice Stores and verifies educational certificates on-chain.
 */
contract CertificateRegistry is Ownable, Pausable {

    enum CertificateStatus { Active, Revoked }

    struct Certificate {
        string            certId;
        bytes32           documentHash;
        string            ipfsCID;
        string            institutionId;
        string            studentId;
        string            studentName;
        string            courseName;
        uint256           issuedAt;
        CertificateStatus status;
    }

    struct VerifyResult {
        bool    isValid;
        uint8   status;
        string  institution;
        string  student;
        string  course;
        uint256 issuedAt;
        string  ipfsCID;
    }

    mapping(string => Certificate) private _certificates;
    mapping(bytes32 => string)     private _hashToCertId;
    mapping(string => string[])    private _studentCertificates;
    mapping(string => string[])    private _institutionCertificates;
    mapping(string => bool)        private _certIdExists;

    uint256 public totalCertificates;

    event CertificateIssued(
        string  indexed certId,
        bytes32 indexed documentHash,
        string          institutionId,
        string          studentId,
        string          courseName,
        uint256         timestamp
    );

    event CertificateRevoked(
        string  indexed certId,
        address indexed revokedBy,
        uint256         timestamp
    );

    modifier certMustExist(string memory certId) {
        require(_certIdExists[certId], "CertRegistry: certificate not found");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function issueCertificate(
        string  calldata certId,
        bytes32          documentHash,
        string  calldata ipfsCID,
        string  calldata institutionId,
        string  calldata studentId,
        string  calldata studentName,
        string  calldata courseName
    ) external onlyOwner whenNotPaused {
        require(!_certIdExists[certId],                        "CertRegistry: certId already exists");
        require(documentHash != bytes32(0),                    "CertRegistry: document hash cannot be empty");
        require(bytes(ipfsCID).length > 0,                     "CertRegistry: IPFS CID cannot be empty");
        require(bytes(institutionId).length > 0,               "CertRegistry: institutionId cannot be empty");
        require(bytes(studentId).length > 0,                   "CertRegistry: studentId cannot be empty");
        require(bytes(studentName).length > 0,                 "CertRegistry: student name cannot be empty");
        require(bytes(courseName).length > 0,                  "CertRegistry: course name cannot be empty");
        require(bytes(_hashToCertId[documentHash]).length == 0,"CertRegistry: this document is already registered");

        _certificates[certId] = Certificate({
            certId:        certId,
            documentHash:  documentHash,
            ipfsCID:       ipfsCID,
            institutionId: institutionId,
            studentId:     studentId,
            studentName:   studentName,
            courseName:    courseName,
            issuedAt:      block.timestamp,
            status:        CertificateStatus.Active
        });

        _certIdExists[certId]       = true;
        _hashToCertId[documentHash] = certId;
        _studentCertificates[studentId].push(certId);
        _institutionCertificates[institutionId].push(certId);
        totalCertificates++;

        emit CertificateIssued(certId, documentHash, institutionId, studentId, courseName, block.timestamp);
    }

    function revokeCertificate(string calldata certId)
        external onlyOwner certMustExist(certId) whenNotPaused
    {
        require(
            _certificates[certId].status == CertificateStatus.Active,
            "CertRegistry: certificate is already revoked"
        );
        _certificates[certId].status = CertificateStatus.Revoked;
        emit CertificateRevoked(certId, msg.sender, block.timestamp);
    }

    function verifyCertificateById(string calldata certId)
        external view returns (VerifyResult memory result)
    {
        if (!_certIdExists[certId]) {
            return VerifyResult(false, 1, "", "", "", 0, "");
        }
        Certificate storage cert = _certificates[certId];
        result.isValid      = cert.status == CertificateStatus.Active;
        result.status       = uint8(cert.status);
        result.institution  = cert.institutionId;
        result.student      = cert.studentName;
        result.course       = cert.courseName;
        result.issuedAt     = cert.issuedAt;
        result.ipfsCID      = cert.ipfsCID;
    }

    function verifyCertificateByHash(bytes32 documentHash)
        external view returns (bool isValid, string memory certId)
    {
        certId = _hashToCertId[documentHash];
        if (bytes(certId).length == 0) return (false, "");
        isValid = _certificates[certId].status == CertificateStatus.Active;
    }

    function getCertificate(string calldata certId)
        external view certMustExist(certId) returns (Certificate memory)
    {
        return _certificates[certId];
    }

    function getStudentCertificates(string calldata studentId)
        external view returns (string[] memory)
    {
        return _studentCertificates[studentId];
    }

    function getInstitutionCertificates(string calldata institutionId)
        external view returns (string[] memory)
    {
        return _institutionCertificates[institutionId];
    }

    function certificateExists(string calldata certId)
        external view returns (bool)
    {
        return _certIdExists[certId];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}