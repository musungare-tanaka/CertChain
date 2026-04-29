#!/bin/sh
set -eu

HARDHAT_HOST="${HARDHAT_HOST:-0.0.0.0}"
HARDHAT_PORT="${HARDHAT_PORT:-8545}"
AUTO_DEPLOY_CONTRACT="${AUTO_DEPLOY_CONTRACT:-true}"
DEPLOY_MAX_ATTEMPTS="${DEPLOY_MAX_ATTEMPTS:-30}"
DEPLOY_RETRY_DELAY_SECONDS="${DEPLOY_RETRY_DELAY_SECONDS:-2}"

cleanup() {
  if [ -n "${NODE_PID:-}" ] && kill -0 "$NODE_PID" 2>/dev/null; then
    kill "$NODE_PID"
    wait "$NODE_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM

echo "Starting Hardhat node on ${HARDHAT_HOST}:${HARDHAT_PORT}"
npx hardhat node --hostname "$HARDHAT_HOST" --port "$HARDHAT_PORT" &
NODE_PID="$!"

if [ "$AUTO_DEPLOY_CONTRACT" = "true" ]; then
  echo "Auto-deploy enabled. Deploying CertificateRegistry..."
  attempt=1
  while [ "$attempt" -le "$DEPLOY_MAX_ATTEMPTS" ]; do
    if npx hardhat run scripts/deploy.ts --network localhost; then
      echo "CertificateRegistry deployment completed."
      break
    fi

    if [ "$attempt" -eq "$DEPLOY_MAX_ATTEMPTS" ]; then
      echo "CertificateRegistry deployment failed after ${DEPLOY_MAX_ATTEMPTS} attempts." >&2
      cleanup
      exit 1
    fi

    echo "Deploy attempt ${attempt}/${DEPLOY_MAX_ATTEMPTS} failed. Retrying in ${DEPLOY_RETRY_DELAY_SECONDS}s..."
    attempt=$((attempt + 1))
    sleep "$DEPLOY_RETRY_DELAY_SECONDS"
  done
else
  echo "Auto-deploy disabled. Skipping CertificateRegistry deployment."
fi

wait "$NODE_PID"
