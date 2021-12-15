const fs = require('fs')
const path = require('path')

async function register ({
  storageManager,
  peertubeHelpers,
  getRouter
}) {
  const { logger } = peertubeHelpers

  {
    await storageManager.storeData('superkey', { value: 'toto' })
    await storageManager.storeData('anotherkey', { value: 'toto2' })
    await storageManager.storeData('storedArrayKey', ['toto', 'toto2'])

    const result = await storageManager.getData('superkey')
    logger.info('superkey stored value is %s', result.value)

    const storedArrayValue = await storageManager.getData('storedArrayKey')
    logger.info('storedArrayKey value type is %s', typeof storedArrayValue)
    logger.info('storedArrayKey stored value is %s', storedArrayValue.join(', '))
  }

  {
    getRouter().get('/create-file', async (req, res) => {
      const basePath = peertubeHelpers.plugin.getDataDirectoryPath()

      fs.writeFile(path.join(basePath, 'Aladdin.txt'), 'Prince Ali', function (err) {
        if (err) return res.sendStatus(500)

        res.sendStatus(200)
      })
    })
  }
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ###########################################################################
