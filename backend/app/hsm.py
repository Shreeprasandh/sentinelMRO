import os
from cryptography.hazmat.primitives.asymmetric import ed25519

class HSMEnclaveSimulation:
    def __init__(self):
        # Stored privately in-memory, never exposed to external API calls
        self._enclave_keys = {}
        # Public key registry (hex-encoded)
        self.public_registry = {}
        
    def initialize(self):
        if self._enclave_keys:
            return
            
        print("Initializing Hardware Security Module (HSM) Enclave...")
        for i in range(1, 4):
            station_id = f"STATION_00{i}"
            # Generate keypair inside the enclave sandbox
            priv_key = ed25519.Ed25519PrivateKey.generate()
            pub_key = priv_key.public_key()
            
            # Save inside the private enclave memory
            self._enclave_keys[station_id] = priv_key
            self.public_registry[station_id] = pub_key.public_bytes_raw().hex()
        print("HSM Enclave Initialized: STATION_001, STATION_002, STATION_003 keys sealed.")

    def secure_sign(self, station_id: str, message: str, pin: str = "MRO-SECURE-PIN-2026") -> str:
        """
        Signs a message inside the enclave boundaries. 
        Requires authorization via standard PIN clearance.
        """
        if pin != "MRO-SECURE-PIN-2026":
            raise PermissionError("HSM Access Violation: Invalid Authorization PIN.")
            
        if station_id not in self._enclave_keys:
            raise ValueError(f"HSM Error: Station {station_id} is not registered in the HSM Enclave.")
            
        # The signing takes place entirely inside the secure enclave sandbox
        private_key = self._enclave_keys[station_id]
        signature = private_key.sign(message.encode('utf-8'))
        return signature.hex()

    def get_public_registry(self) -> dict:
        """
        Exposes public keys only. No private keys are ever returned.
        """
        return {
            station_id: {
                "public": pub_hex
            }
            for station_id, pub_hex in self.public_registry.items()
        }

# Instantiate the enclave singleton
hsm_enclave = HSMEnclaveSimulation()
hsm_enclave.initialize()
