////
/* GLOBAL VARIABLES INITIALIZATION */
////

// Access keys for PositionStack (PS) & OpenChargeMap (OC) APIs
const psaccesskey = '2924b2440dcf51f5ba91437412fead7d'
const ocaccesskey = '9f2e41d5-3c41-43bc-9376-ad390fe352f4'

// Global variable storing whether or not a first search has been conducted
let firstSearchCompleted = false

// Global variable storing whether or not a new search has been initiated
let newSearch = false

// Global variables for latitude and longitude of the search address and directions origin
let searchLat
let searchLong
let directionsLat
let directionsLong

// Global variable for storing the search address as a string 
let addressString

// Global variable for storing the results of the OpenChargeMap API hit (charging locations)
let stationArray = []

// GLobal variables for storing selected search radius in miles, connection type
let searchRadius = 1
let connectionType = "all"


////
/* DOMContentLoaded & NON-ITERATED EVENT LISTENERS */
////

//When DOM is loaded, centers main page elements, adds event listener for search radius selector, adds submit form event listener
document.addEventListener('DOMContentLoaded', event => {
    document.querySelector('#searchRadius').addEventListener('change', event => changeSearchRadius(event))
    document.querySelector('#connectionType').addEventListener('change', event => changeConnectionType(event))
    document.querySelector('#currentLocationButton').addEventListener('click', event => getCoordinatesFromBrowser(true))
    document.querySelector('form').addEventListener('submit', event => submitForm(event))
})


////
/* MISC. FUNCTIONS */
////

// Takes in a number to be rounded and a number of decimal places to round to. Returns the rounded number
function round(num, places) {
    const factorOfTen = Math.pow(10, places);
    return Math.round(num * factorOfTen)/factorOfTen;
}


////
/* EVENT HANDLERS */
////

// Sets search radius variable to user selected value, removes every displayed result station, rerenders result stations within the search radius
function changeSearchRadius(event) {
    searchRadius = parseInt(event.target.value, 10)
    stationArray.forEach(station => removeResults(station))
    renderResults()
}

// Sets connection type variable to user selected value, removes every displayed result station, rerenders result stations with a matching connection type
function changeConnectionType(event) {
    connectionType = event.target.value
    stationArray.forEach(station => removeResults(station))
    renderResults()
}

// Called when submit button is clicked. Prevents default page reload, converts inputs into an address string, passes the string to getCoordinates
function submitForm(event) {
    event.preventDefault()
    event.target.reset()
    newSearch = true
    addressString = `${event.target[0].value}, ${event.target[1].value}, ${event.target[2].value} ${event.target[3].value} ${event.target[4].value}`
    getCoordinatesFromAddress(addressString)
}


////
/* API FUNCTIONS */
////

//
function getAddressFromCoordinates(coordinateString) {
    fetch(`http://api.positionstack.com/v1/reverse?access_key=${psaccesskey}&query=${coordinateString}&limit=1`)
    .then(resp => resp.json())
    .then(coordData => {
        addressString = `${coordData.data[0].name}, ${coordData.data[0].locality}, ${coordData.data[0].region_code} ${(coordData.data[0].postal_code ? Math.round(coordData.data[0].postal_code) : "")} ${coordData.data[0].country_code}`
    })
}

// Takes the address string from submitForm and initiates a GET request to PS API. The promise resolves to the lat & long coordinates of the address
// which are stored in the global searchLat & searchLong variables. getChargePoints is then called
function getCoordinatesFromAddress(addressString) {
    fetch(`http://api.positionstack.com/v1/forward?access_key=${psaccesskey}&query=${addressString}&limit=1`)
    .then(resp => resp.json())
    .then(coordData => {
        searchLat = parseFloat(coordData.data[0].latitude)
        searchLong = parseFloat(coordData.data[0].longitude)
        getChargePoints()
    })
}

// Gets user's lat & long coordinates from the browser if possible and assigns to searchLat & searchLong or directionsLat & directionsLong variables respectively.
// If the request is not for the source conditions (i.e. !forSource), addressInfo will be passed in and browser will open new tab with google maps directions for
// route from source coordinates to destination coordinates
function getCoordinatesFromBrowser(forSource, addressInfo) {
    if (forSource === false) {
        navigator.geolocation.getCurrentPosition(function(position) {
            directionsLat = parseFloat(position.coords.latitude)
            directionsLong = parseFloat(position.coords.longitude)
            window.open(`https://www.google.com/maps/dir/?api=1&origin=${directionsLat},${directionsLong}&destination=${addressInfo.Latitude},${addressInfo.Longitude}`, '_blank')
        }, function(error) {
            directionsLat = searchLat
            directionsLong = searchLong
            window.open(`https://www.google.com/maps/dir/?api=1&origin=${directionsLat},${directionsLong}&destination=${addressInfo.Latitude},${addressInfo.Longitude}`, '_blank')
        })
    } else {
        navigator.geolocation.getCurrentPosition(function(position) {
            searchLat = parseFloat(position.coords.latitude)
            searchLong = parseFloat(position.coords.longitude)
            newSearch = true
            getAddressFromCoordinates(`${searchLat},${searchLong}`)
            getChargePoints()
        }, function(error) {
            // TO DO: Tell user that geolocation is not supported by this browser.";
        })
    }
}

// Constructs GET payload, specifying JSON content type, initiates GET passing the latitude & longitude request to OC API. The promise resolves to an array 
// of e-charge stations within 25mi of the searchLat,Long. Relevant data is then extracted from the response and stored in the global stationArray. Finally,
// renderResults is called
function getChargePoints() {
    const getObj = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    fetch(`https://api.openchargemap.io/v3/poi?latitude=${searchLat}&longitude=${searchLong}&distance=25&key=${ocaccesskey}`, getObj)
    .then(resp => resp.json())
    .then(data => {
        if (firstSearchCompleted === true) {
            stationArray.forEach(station => removeResults(station))
            stationArray = []
        }
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


////
/* DOM FUNCTIONS*/
////

// If the station is currently being displayed, removes result display from DOM and removes reference to the DOM element from the stationArray
function removeResults(station) {
    if (station.resultElement) {
         document.getElementById("resultDisplay").removeChild(station.resultElement)
         delete station.resultElement
    }
}  

// Makes the results container visible, for each station in the stationArray checks if...
// 1. Its distance from searchLat,Long is within search radius.
// 2. It has a connection type which matches the user selection.
// If so, renders the relevant station data 
function renderResults() {
    const resultsContainer = document.getElementById("resultsContainer")
    if (firstSearchCompleted === true) {
        document.querySelector('#addressContainer').removeChild(document.querySelector('#addressContainer p'))
    }
    if (newSearch === true) {
        document.getElementById('searchRadius').selectedIndex = 0
        document.getElementById('connectionType').selectedIndex = 0
        searchRadius = 1
        connectionType = "all"
    }
    resultsContainer.style.visibility = "visible"
    const addressP = document.createElement('p')
    addressP.innerText = addressString
    addressP.id = "addressP"
    document.querySelector('#addressContainer').appendChild(addressP)
    const resultDisplay = document.querySelector("#resultDisplay")
    stationArray.forEach(station => {
        const addressInfo = station.addressInfo
        const connectionsInfo = station.connections
        if (addressInfo.Distance <= searchRadius) {
            if (connectionType === "all" || connectionsInfo.find(connection => connection.ConnectionType.FormalName && connection.ConnectionType.FormalName.includes(connectionType))) {
                const resultBlock = document.createElement("div")
                resultBlock.className = "resultBlock"
                const resultDiv = document.createElement("div")
                resultDiv.className = "resultDiv"
                const row1Div = document.createElement('div')
                row1Div.className = "row1Div"
                row1Div.appendChild(renderTitleAddress(addressInfo))
                row1Div.appendChild(renderDirectionsButton(addressInfo))
                resultDiv.appendChild(row1Div)
                resultDiv.appendChild(renderConnections(station))
                resultBlock.appendChild(resultDiv)
                resultDisplay.appendChild(resultBlock)
                station.resultElement = resultBlock
            }
        }
    })
    firstSearchCompleted = true
    newSearch = false
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

function renderDirectionsButton(addressInfo) {
    const directionsButtonDiv = document.createElement('div')
    directionsButtonDiv.className = "directionsButtonDiv"
    const directionsButton = document.createElement('button')
    directionsButton.className = "btn btn-md btn-default button"
    directionsButton.classList.add("directionsButton")
    directionsButton.addEventListener('click', event => getCoordinatesFromBrowser(false, addressInfo))
    directionsButton.innerText = "Get Directions"
    directionsButtonDiv.appendChild(directionsButton)
    return directionsButtonDiv
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
        connectionSpan.className = "connectionSpan"
        if (connection.ConnectionType.FormalName) {
            const ctimg = document.createElement('img')
            ctimg.className = "ctimg"
            ctimg.src = getImage(connection.ConnectionType.FormalName)
            connectionSpan.appendChild(ctimg)
        }
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

function getImage(imageString) {
    if (imageString.includes("J1772")) {
        return "./assets/Type1_J1772.png"
    } else if (imageString.includes("62196")) {
        return "./assets/62196.png"
    } else if (imageString.includes("Tesla")) {
        return "./assets/Tesla.png"
    }
}