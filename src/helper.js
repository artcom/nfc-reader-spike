const APPLICATION_ID = "F222222222"
const APPLICATION_ID_NOT_FOUND_RESPONSE = 0x6a82

const SCARD_STATE_PRESENT = 32
const SCARD_STATE_EMPTY = 16

module.exports.isNewTag = (state, newState) => {
  const changes = state ^ newState
  return changes & SCARD_STATE_PRESENT && newState & SCARD_STATE_PRESENT
}

module.exports.isTagRemoved = (state, newState) => {
  const changes = state ^ newState
  return changes & SCARD_STATE_EMPTY && newState & SCARD_STATE_EMPTY
}

module.exports.connectTag = (reader, atr) => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line camelcase
    reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (error, protocol) => {
      if (error) {
        reject(error)
      }

      const payload = readPayload(reader, protocol, atr)
      resolve(payload)
    })
  })
}

async function readPayload(reader, protocol, atr) {
  if (atr[5] && atr[5] === 0x4f) {
    return await readPayloadIso144433(reader, protocol, 0, 128)
  } else {
    return await readPayloadIso144434(reader, protocol)
  }
}

function readPayloadIso144433(
  reader,
  protocol,
  blockNumber,
  length,
  blockSize = 4,
  packetSize = 16) {
  if (length > packetSize) {
    const p = Math.ceil(length / packetSize)
    const commands = []
    for (let i = 0; i < p; i++) {
      const block = blockNumber + i * packetSize / blockSize
      const size = (i + 1) * packetSize < length ? packetSize : length - i * packetSize
      commands.push(readPayloadIso144433(reader, protocol, block, size, blockSize, packetSize))
    }

    return Promise.all(commands).then(values => Buffer.concat(values, length))
  } else {
    const packet = new Buffer([
      0xff, // Class
      0xb0, // Ins
      0x00, // P1
      blockNumber, // P2: Block Number
      length  // Le: Number of Bytes to Read (Maximum 16 bytes)
    ])

    return new Promise((resolve, reject) => {
      reader.transmit(packet, length + 2, protocol, (error, response) => {
        if (error) {
          reject(error)
          return
        }
        const code = parseInt(response.slice(-2).toString("hex"), 16)
        if (code !== 0x9000) {
          const error = new Error("Operation failed")
          reject(error)
          return
        }
        const data = response.slice(0, -2)
        resolve(data)
      })
    })
  }
}

function readPayloadIso144434(reader, protocol) {
  const aid = APPLICATION_ID
  const apduCommand = "00A4040005"
  const message = new Buffer(apduCommand + aid, "hex")

  return new Promise((resolve, reject) => {
    reader.transmit(message, 40, protocol, (error, response) => {
      if (error) {
        reject(error)
        return
      }

      if (response.length === 2 && response.readUInt16BE(0) === APPLICATION_ID_NOT_FOUND_RESPONSE) {
        reject(new Error("Application id not found"))
      }

      resolve(response.toString())
    })
  })
}

module.exports.disconnectTag = (reader) => {
  return new Promise((resolve, reject) => {
    reader.disconnect(reader.SCARD_LEAVE_CARD, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}