import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CertificateRegistryModule = buildModule("CertificateRegistryModule", (m) => {
  const registry = m.contract("CertificateRegistry");

  return { registry };
});

export default CertificateRegistryModule;
