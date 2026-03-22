import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

function hashDocument(content: string): string {
  return keccak256(toUtf8Bytes(content));
}

const CERT_ID        = "cert-uuid-001";
const IPFS_CID       = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
const INSTITUTION_ID = "inst-uuid-001";
const STUDENT_ID     = "student-uuid-001";
const STUDENT_NAME   = "John Doe";
const COURSE_NAME    = "Bachelor of Computer Science";
const DOC_HASH       = hashDocument("fake-pdf-content-001");

describe("CertificateRegistry", function () {
  let registry: any;
  let owner: any;
  let otherAccount: any;
  let ethers: any;

  beforeEach(async function () {
    const connection = await hre.network.connect();
    ethers = connection.ethers;
    [owner, otherAccount] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CertificateRegistry");
    registry = await factory.deploy();
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the deployer as the owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should start with zero total certificates", async function () {
      expect(await registry.totalCertificates()).to.equal(0);
    });

    it("should start unpaused", async function () {
      expect(await registry.paused()).to.equal(false);
    });
  });

  describe("Issuing Certificates", function () {
    it("should allow the owner to issue a certificate", async function () {
      await expect(
        registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME)
      ).to.emit(registry, "CertificateIssued");
    });

    it("should increment totalCertificates after issuance", async function () {
      await registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME);
      expect(await registry.totalCertificates()).to.equal(1);
    });

    it("should store correct certificate data on-chain", async function () {
      await registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME);
      const cert = await registry.getCertificate(CERT_ID);
      expect(cert.certId).to.equal(CERT_ID);
      expect(cert.documentHash).to.equal(DOC_HASH);
      expect(cert.ipfsCID).to.equal(IPFS_CID);
      expect(cert.institutionId).to.equal(INSTITUTION_ID);
      expect(cert.studentId).to.equal(STUDENT_ID);
      expect(cert.studentName).to.equal(STUDENT_NAME);
      expect(cert.courseName).to.equal(COURSE_NAME);
      expect(cert.status).to.equal(0);
    });

    it("should reject a duplicate certId", async function () {
      await registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME);
      await expect(
        registry.issueCertificate(CERT_ID, hashDocument("different-pdf"), IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME)
      ).to.be.revertedWith("CertRegistry: certId already exists");
    });

    it("should reject a duplicate document hash", async function () {
      await registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME);
      await expect(
        registry.issueCertificate("cert-uuid-002", DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME)
      ).to.be.revertedWith("CertRegistry: this document is already registered");
    });

    it("should reject issuance from a non-owner address", async function () {
      await expect(
        registry.connect(otherAccount).issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should reject issuance when contract is paused", async function () {
      await registry.pause();
      await expect(
        registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });

    it("should reject empty student name", async function () {
      await expect(
        registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, "", COURSE_NAME)
      ).to.be.revertedWith("CertRegistry: student name cannot be empty");
    });

    it("should reject empty IPFS CID", async function () {
      await expect(
        registry.issueCertificate(CERT_ID, DOC_HASH, "", INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME)
      ).to.be.revertedWith("CertRegistry: IPFS CID cannot be empty");
    });
  });

  describe("Verification by Certificate ID", function () {
    beforeEach(async function () {
      await registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME);
    });

    it("should return isValid=true for an active certificate", async function () {
      const result = await registry.verifyCertificateById(CERT_ID);
      expect(result.isValid).to.equal(true);
      expect(result.status).to.equal(0);
    });

    it("should return correct details for a valid certificate", async function () {
      const result = await registry.verifyCertificateById(CERT_ID);
      expect(result.institution).to.equal(INSTITUTION_ID);
      expect(result.student).to.equal(STUDENT_NAME);
      expect(result.course).to.equal(COURSE_NAME);
      expect(result.ipfsCID).to.equal(IPFS_CID);
    });

    it("should return isValid=false for a non-existent certificate", async function () {
      const result = await registry.verifyCertificateById("non-existent-id");
      expect(result.isValid).to.equal(false);
    });

    it("should return isValid=false for a revoked certificate", async function () {
      await registry.revokeCertificate(CERT_ID);
      const result = await registry.verifyCertificateById(CERT_ID);
      expect(result.isValid).to.equal(false);
      expect(result.status).to.equal(1);
    });
  });

  describe("Verification by Document Hash", function () {
    beforeEach(async function () {
      await registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME);
    });

    it("should return isValid=true when hash matches an active certificate", async function () {
      const result = await registry.verifyCertificateByHash(DOC_HASH);
      expect(result.isValid).to.equal(true);
      expect(result.certId).to.equal(CERT_ID);
    });

    it("should return isValid=false for an unregistered hash", async function () {
      const result = await registry.verifyCertificateByHash(hashDocument("unknown-document"));
      expect(result.isValid).to.equal(false);
      expect(result.certId).to.equal("");
    });

    it("should return isValid=false when hash matches a revoked certificate", async function () {
      await registry.revokeCertificate(CERT_ID);
      const result = await registry.verifyCertificateByHash(DOC_HASH);
      expect(result.isValid).to.equal(false);
    });
  });

  describe("Revoking Certificates", function () {
    beforeEach(async function () {
      await registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME);
    });

    it("should allow owner to revoke an active certificate", async function () {
      await expect(registry.revokeCertificate(CERT_ID)).to.emit(registry, "CertificateRevoked");
    });

    it("should mark certificate status as Revoked", async function () {
      await registry.revokeCertificate(CERT_ID);
      const cert = await registry.getCertificate(CERT_ID);
      expect(cert.status).to.equal(1);
    });

    it("should reject revoking an already revoked certificate", async function () {
      await registry.revokeCertificate(CERT_ID);
      await expect(registry.revokeCertificate(CERT_ID)).to.be.revertedWith("CertRegistry: certificate is already revoked");
    });

    it("should reject revocation from a non-owner address", async function () {
      await expect(
        registry.connect(otherAccount).revokeCertificate(CERT_ID)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should reject revoking a non-existent certificate", async function () {
      await expect(registry.revokeCertificate("non-existent-id")).to.be.revertedWith("CertRegistry: certificate not found");
    });
  });

  describe("Getters", function () {
    it("should return all certificates for a student", async function () {
      await registry.issueCertificate("cert-001", hashDocument("pdf-001"), IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, "BSc Computer Science");
      await registry.issueCertificate("cert-002", hashDocument("pdf-002"), IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, "MSc Data Science");
      const certs = await registry.getStudentCertificates(STUDENT_ID);
      expect(certs.length).to.equal(2);
      expect(certs).to.include("cert-001");
      expect(certs).to.include("cert-002");
    });

    it("should return all certificates for an institution", async function () {
      await registry.issueCertificate("cert-001", hashDocument("pdf-001"), IPFS_CID, INSTITUTION_ID, "student-001", "Alice", "BSc Computer Science");
      await registry.issueCertificate("cert-002", hashDocument("pdf-002"), IPFS_CID, INSTITUTION_ID, "student-002", "Bob", "BSc Engineering");
      const certs = await registry.getInstitutionCertificates(INSTITUTION_ID);
      expect(certs.length).to.equal(2);
    });

    it("should return true for certificateExists on an issued cert", async function () {
      await registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME);
      expect(await registry.certificateExists(CERT_ID)).to.equal(true);
    });

    it("should return false for certificateExists on unknown certId", async function () {
      expect(await registry.certificateExists("unknown-id")).to.equal(false);
    });
  });

  describe("Pause and Unpause", function () {
    it("should allow owner to pause the contract", async function () {
      await registry.pause();
      expect(await registry.paused()).to.equal(true);
    });

    it("should allow owner to unpause the contract", async function () {
      await registry.pause();
      await registry.unpause();
      expect(await registry.paused()).to.equal(false);
    });

    it("should reject pause from non-owner", async function () {
      await expect(
        registry.connect(otherAccount).pause()
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should allow issuance again after unpausing", async function () {
      await registry.pause();
      await registry.unpause();
      await expect(
        registry.issueCertificate(CERT_ID, DOC_HASH, IPFS_CID, INSTITUTION_ID, STUDENT_ID, STUDENT_NAME, COURSE_NAME)
      ).to.emit(registry, "CertificateIssued");
    });
  });
});
