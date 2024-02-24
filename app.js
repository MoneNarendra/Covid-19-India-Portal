const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
app.use(express.json())

let db = null

const initilaieDbAndserver = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Started.....')
    })
  } catch (e) {
    console.log(`Error DB: ${e.message}`)
    process.exit(1)
  }
}

initilaieDbAndserver()

function stateKeys(eachState) {
  return {
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  }
}

function ConvertDistictKeys(eachDist) {
  return {
    districtId: eachDist.district_id,
    districtName: eachDist.district_name,
    stateId: eachDist.state_id,
    cases: eachDist.cases,
    cured: eachDist.cured,
    active: eachDist.active,
    deaths: eachDist.deaths,
  }
}

const Authentication = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRET_KEY', async (error, playload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        // response.send(playload)
        next()
      }
    })
  }
}



// login user (API 1)
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuary = `SELECT * FROM user WHERE username = '${username}'`
  const getUser = await db.get(getUserQuary)

  if (getUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordValid = await bcrypt.compare(password, getUser.password)
    if (isPasswordValid) {
      const playload = {username: username}
      const jwtToken = jwt.sign(playload, 'SECRET_KEY')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// list of all states (API 2)
app.get('/states/', Authentication, async (request, response) => {
  const getAllStatesQuery = `SELECT * FROM state`
  const getAllStates = await db.all(getAllStatesQuery)
  response.send(getAllStates.map(eachState => stateKeys(eachState)))
})

// state based on the state ID (API 3)
app.get('/states/:stateId/', Authentication, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `SELECT * FROM state  where state_id = '${stateId}'`
  const getState = await db.get(getStateQuery)
  response.send(stateKeys(getState))
})

// get all district
app.get('/district/', Authentication, async (request, response) => {
  const getAllDistrictQuery = `SELECT * FROM district`
  const getAllDistrict = await db.all(getAllDistrictQuery)
  response.send(getAllDistrict)
})

// Create a district in the district table (API 4)
app.post('/districts/', Authentication, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDistrictQuery = `
    INSERT INTO 
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES
      ('${districtName}', ${stateId}, ${cases},${cured}, ${active}, ${deaths});`
  await db.run(addDistrictQuery)
  response.send('District Successfully Added')
})

// GET district based on the district ID (API 5)
app.get(
  '/districts/:districtId/',
  Authentication,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`
    const getDistrict = await db.get(getDistrictQuery)
    response.send(ConvertDistictKeys(getDistrict))
  },
)

// Deletes a district (API 6)
app.delete(
  '/districts/:districtId/',
  Authentication,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistictQuery = `DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(deleteDistictQuery)
    response.send('District Removed')
  },
)

// Updates the details of a specific district (API 7)
app.put(
  '/districts/:districtId/',
  Authentication,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistQuery = `
      UPDATE 
        district
      SET 
        district_name = '${districtName}',
        state_id	= ${stateId},
        cases = ${cases},
        cured	= ${cured},
        active = ${active},
        deaths = ${deaths};
      WHERE
        district_id = ${districtId}`
    await db.run(updateDistQuery)
    response.send('District Details Updated')
  },
)

//statistics of total cases, cured, active, deaths of a specific state
app.get(
  '/states/:stateId/stats/',
  Authentication,
  async (request, response) => {
    const {stateId} = request.params
    // console.log(stateId)
    const getsStatsQuery = `
    SELECT 
      SUM(cases) as totalCases,
      SUM(cured) as totalCured,
      SUM(active) as totalActive,
      SUM(deaths) as totalDeaths
    FROM
      district
    WHERE
      state_id = ${stateId};`
    const getStats = await db.get(getsStatsQuery)
    response.send(getStats)
  },
)

module.exports = app
