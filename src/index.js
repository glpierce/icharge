// Access keys for PositionStack (PS) & OpenChargeMap (OC) APIs
const psaccesskey = '2924b2440dcf51f5ba91437412fead7d'
const ocaccesskey = '9f2e41d5-3c41-43bc-9376-ad390fe352f4'

// Global variables for latitude and longitude of input address
let sourceLat
let sourceLong

// Global variable for storing the results of the OC API hit
let stationArray = []

// GLobal variables for storing selected search radius in miles, connection type, and current type
let searchRadius = 1
let connectionType = "all"

//When DOM is loaded, centers main page elements, adds event listener for search radius selector, adds submit form event listener
document.addEventListener('DOMContentLoaded', event => {
    arragePage()
    window.onresize = function() {arragePage()}
    document.querySelector('#searchRadius').addEventListener('change', event => changeSearchRadius(event))
    document.querySelector('#connectionType').addEventListener('change', event => changeConnectionType(event))
    const form = document.querySelector('form')
    form.addEventListener('submit', event => submitForm(event))
})

// Sets two major page elements (search block & results block) centered in the window
function arragePage() {
    document.querySelector('#formContainer').style.left = `${(window.innerWidth / 2) - 506}px`
    document.querySelector('#resultsContainer').style.left = `${(window.innerWidth / 2) - 506}px`
}

// Sets search radius variable to user selected value, removes every displayed result station, rerenders result stations within the search radius
function changeSearchRadius(event) {
    searchRadius = parseInt(event.target.value, 10)
    stationArray.forEach(station => removeResults(station))
    renderResults()
}

// Sets connection type variable to user selected value, removes every displayed result station, rerenders result stations with matching connection type
function changeConnectionType(event) {
    connectionType = event.target.value
    stationArray.forEach(station => removeResults(station))
    renderResults()
}

// If the station is currently being displayed, removes result display from DOM and removes reference to the DOM element from the stationArray
function removeResults(station) {
   if (station.resultElement) {
        document.getElementById("resultsContainer").removeChild(station.resultElement)
        delete station.resultElement
   }  
}

// Called when submit button is clicked. Prevents default page reload, converts inputs into an address string, passes the string to getCoordinates
function submitForm(event) {
    event.preventDefault()
    const addressString = `${event.target[0].value}, ${event.target[1].value}, ${event.target[2].value} ${event.target[3].value} ${event.target[4].value}`
    event.target.reset()
    getCoordinates(addressString)
}

// Takes the address string from submitForm and initiates a GET request to PS API. The promise resolves to the lat & long coordinates of the address
// which are stored in the global sourceLat & sourceLong variables. getChargePoints is then called
function getCoordinates(addressString) {
    fetch(`http://api.positionstack.com/v1/forward?access_key=${psaccesskey}&query=${addressString}&limit=1`)
    .then(resp => resp.json())
    .then(coordData => {
        sourceLat = parseFloat(coordData.data[0].latitude)
        sourceLong = parseFloat(coordData.data[0].longitude)
        getChargePoints()
    })
}

// Constructs GET payload, specifying JSON content type, initiates GET passing the latitude & longitude request to OC API. The promise resolves to an array 
// of e-charge stations within 25mi of the sourceLat,Long. Relevant data is then extracted from the response and stored in the global stationArray. Finally,
// renderResults is called
function getChargePoints() {
    const getObj = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    fetch(`https://api.openchargemap.io/v3/poi?latitude=${sourceLat}&longitude=${sourceLong}&distance=25&key=${ocaccesskey}`, getObj)
    .then(resp => resp.json())
    .then(data => {
        console.log(data)
        data.forEach(station => stationArray.push({
            stationID: station.ID,
            stationUID: station.UUID,
            dataQuality: station.DataQualityLevel,
            status: station.statusType,
            lastStatusUpdate: station.DateLastStatusUpdate,
            usageCost: station.UsageCost,
            usageType: station.UsageType,
            connections: station.Connections,
            operatorInfo: station.OperatorInfo,
            addressInfo: station.AddressInfo
        }))
        console.log(stationArray)
        renderResults()
    })
}

// Makes the results container visible, for each station in the stationArray checks if...
// 1. Its distance from sourceLat,Long is within search radius.
// 2. It has a connection type which matches the user selection.
// If so, renders the relevant station data 
function renderResults() {
    const resultsContainer = document.getElementById("resultsContainer")
    resultsContainer.style.visibility = "visible"
    stationArray.forEach(station => {
        const addressInfo = station.addressInfo
        const connectionsInfo = station.connections
        if (addressInfo.Distance <= searchRadius) {
            if (connectionType === "all" || connectionsInfo.find(connection => connection.ConnectionType.FormalName && connection.ConnectionType.FormalName.includes(connectionType))) {
                const resultDiv = document.createElement("div")
                resultDiv.className = "resultDiv"
                resultDiv.appendChild(renderTitleAddress(addressInfo))
                resultDiv.appendChild(renderConnections(station))
                resultsContainer.appendChild(resultDiv)
                station.resultElement = resultDiv
            }
        }
    });
}

// Creates a div containing the station's title, address, and distance from user. Returns the div to renderResults to be rendered to the DOM
function renderTitleAddress(addressInfo) {
    const resultTitleDiv = document.createElement('div')
    resultTitleDiv.className = "resultTitleDiv"
    const stationTitle = document.createElement("h3")
    stationTitle.className = "resultTitle"
    stationTitle.innerText = addressInfo.Title
    resultTitleDiv.appendChild(stationTitle)
    const stationAddress = document.createElement("p")
    stationAddress.className = "resultAddress"
    stationAddress.innerText = `${addressInfo.AddressLine1}, ${addressInfo.Town}, ${addressInfo.StateOrProvince} ${addressInfo.Postcode} ${addressInfo.Country.ISOCode}`
    resultTitleDiv.appendChild(stationAddress)
    const distance = document.createElement("p");
    distance.className = "resultDistance";
    distance.innerText =`${round(addressInfo.Distance, 2)} miles away`;
    resultTitleDiv.appendChild(distance)
    return resultTitleDiv
}

// Takes in a number to be rounded and a number of decimal places to round to. Returns the rounded number
function round(num, places) {
    const factorOfTen = Math.pow(10, places);
    return Math.round(num * factorOfTen)/factorOfTen;
}

// Creates a div containing the station's connection information. Returns the div to renderResults to be rendered to the DOM
function renderConnections(station) {
    const connectionsInfoContainer = document.createElement('div')
    connectionsInfoContainer.className = "connectionsInfoContainer"
    const connectionsTitle = document.createElement('h5')
    connectionsTitle.innerText = "Connections:"
    connectionsTitle.className = "connectionsTitle"
    connectionsInfoContainer.appendChild(connectionsTitle)
    station.connections.forEach(connection => {
        const connectionSpan = document.createElement('span')
        connection.className = "connectionSpan"
        const ul = document.createElement('ul')
        ul.className = "connectionList"
        const connectionType = document.createElement('li')
        connectionType.innerText = `${(connection.ConnectionType.FormalName ? connection.ConnectionType.FormalName : "Unknown Type")}`
        connectionType.style.fontWeight = "bold"
        ul.appendChild(connectionType)
        const chargeRate = document.createElement('li')
        chargeRate.innerText = `Charge Rate: ${(connection.PowerKW ? `${connection.PowerKW}kW` : "Unknown")}`
        ul.appendChild(chargeRate)
        const current = document.createElement('li')
        current.innerText = `Current: ${(connection.CurrentType ? connection.CurrentType.Title : 'Unknown')}`
        ul.appendChild(current)
        if (connection.Amps && connection.Voltage) {
            const ampsVolts = document.createElement('li')
            ampsVolts.innerText = `${connection.Amps}A ${connection.Voltage}V`
            ul.appendChild(ampsVolts)
        }
        connectionSpan.appendChild(ul)
        connectionsInfoContainer.appendChild(connectionSpan)
    })
    return connectionsInfoContainer
}
