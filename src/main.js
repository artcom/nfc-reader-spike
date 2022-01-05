const { NFC } = require("nfc-pcsc")

const nfc = new NFC()
nfc.on("reader", reader => handleReader(reader))
nfc.on("error", error => console.log(error))

async function handleReader(reader) {
  console.log({ reader: reader.name }, "Reader connected")
  reader.aid = 'F222222222';

  // disable auto processing
  reader.autoProcessing = false;

  reader.on("card", async card => {
    console.log(`${reader.reader.name}  card detected`, card);
    // example reading 12 bytes assuming containing text in utf8
		try {

			// reader.read(blockNumber, length, blockSize = 4, packetSize = 16)
			const data = await reader.read(0, 112, 4, 4); // starts reading in block 4, continues to 5 and 6 in order to read 12 bytes
      console.log(`data read`, data);
      const startIndex = data.indexOf(0x00)
			console.log("debug: ", startIndex);
      const endIndex = data.indexOf(0xFE)
			console.log("debug: ", endIndex);

      payload = data.slice(startIndex, endIndex).toString() // utf8 is default encoding
			console.log(`data converted`, payload);

		} catch (err) {
			console.error(`error when reading data`, err);
		}
  })

  reader.on("card.off", card => {
		// const payload = card.data.toString()

    // mqttClient.publish(eventTopic, { event: "disconnect", payload })
    console.log("Tag disconnected", { card })
	})

  reader.on("error", error => console.error(error))
  reader.on("end", () => console.error({ reader: reader.name }, "Reader disconnected"))
}
