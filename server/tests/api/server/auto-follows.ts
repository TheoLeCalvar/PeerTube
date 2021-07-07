/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  MockInstancesIndex,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig,
  wait,
  waitJobs
} from '@shared/extra-utils'

const expect = chai.expect

async function checkFollow (follower: ServerInfo, following: ServerInfo, exists: boolean) {
  {
    const body = await following.followsCommand.getFollowers({ start: 0, count: 5, sort: '-createdAt' })
    const follow = body.data.find(f => f.follower.host === follower.host && f.state === 'accepted')

    if (exists === true) expect(follow).to.exist
    else expect(follow).to.be.undefined
  }

  {
    const body = await follower.followsCommand.getFollowings({ start: 0, count: 5, sort: '-createdAt' })
    const follow = body.data.find(f => f.following.host === following.host && f.state === 'accepted')

    if (exists === true) expect(follow).to.exist
    else expect(follow).to.be.undefined
  }
}

async function server1Follows2 (servers: ServerInfo[]) {
  await servers[0].followsCommand.follow({ targets: [ servers[1].host ] })

  await waitJobs(servers)
}

async function resetFollows (servers: ServerInfo[]) {
  try {
    await servers[0].followsCommand.unfollow({ target: servers[1] })
    await servers[1].followsCommand.unfollow({ target: servers[0] })
  } catch { /* empty */
  }

  await waitJobs(servers)

  await checkFollow(servers[0], servers[1], false)
  await checkFollow(servers[1], servers[0], false)
}

describe('Test auto follows', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)
  })

  describe('Auto follow back', function () {

    it('Should not auto follow back if the option is not enabled', async function () {
      this.timeout(15000)

      await server1Follows2(servers)

      await checkFollow(servers[0], servers[1], true)
      await checkFollow(servers[1], servers[0], false)

      await resetFollows(servers)
    })

    it('Should auto follow back on auto accept if the option is enabled', async function () {
      this.timeout(15000)

      const config = {
        followings: {
          instance: {
            autoFollowBack: { enabled: true }
          }
        }
      }
      await updateCustomSubConfig(servers[1].url, servers[1].accessToken, config)

      await server1Follows2(servers)

      await checkFollow(servers[0], servers[1], true)
      await checkFollow(servers[1], servers[0], true)

      await resetFollows(servers)
    })

    it('Should wait the acceptation before auto follow back', async function () {
      this.timeout(30000)

      const config = {
        followings: {
          instance: {
            autoFollowBack: { enabled: true }
          }
        },
        followers: {
          instance: {
            manualApproval: true
          }
        }
      }
      await updateCustomSubConfig(servers[1].url, servers[1].accessToken, config)

      await server1Follows2(servers)

      await checkFollow(servers[0], servers[1], false)
      await checkFollow(servers[1], servers[0], false)

      await servers[1].followsCommand.acceptFollower({ follower: 'peertube@' + servers[0].host })
      await waitJobs(servers)

      await checkFollow(servers[0], servers[1], true)
      await checkFollow(servers[1], servers[0], true)

      await resetFollows(servers)

      config.followings.instance.autoFollowBack.enabled = false
      config.followers.instance.manualApproval = false
      await updateCustomSubConfig(servers[1].url, servers[1].accessToken, config)
    })
  })

  describe('Auto follow index', function () {
    const instanceIndexServer = new MockInstancesIndex()
    let port: number

    before(async () => {
      port = await instanceIndexServer.initialize()
    })

    it('Should not auto follow index if the option is not enabled', async function () {
      this.timeout(30000)

      await wait(5000)
      await waitJobs(servers)

      await checkFollow(servers[0], servers[1], false)
      await checkFollow(servers[1], servers[0], false)
    })

    it('Should auto follow the index', async function () {
      this.timeout(30000)

      instanceIndexServer.addInstance(servers[1].host)

      const config = {
        followings: {
          instance: {
            autoFollowIndex: {
              indexUrl: `http://localhost:${port}/api/v1/instances/hosts`,
              enabled: true
            }
          }
        }
      }
      await updateCustomSubConfig(servers[0].url, servers[0].accessToken, config)

      await wait(5000)
      await waitJobs(servers)

      await checkFollow(servers[0], servers[1], true)

      await resetFollows(servers)
    })

    it('Should follow new added instances in the index but not old ones', async function () {
      this.timeout(30000)

      instanceIndexServer.addInstance(servers[2].host)

      await wait(5000)
      await waitJobs(servers)

      await checkFollow(servers[0], servers[1], false)
      await checkFollow(servers[0], servers[2], true)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
