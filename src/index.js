////
/* GLOBAL VARIABLES INITIALIZATION */
////

// Access keys for PositionStack (https://positionstack.com/documentation) & OpenChargeMap (https://openchargemap.org/site) APIs
const psaccesskey = '2924b2440dcf51f5ba91437412fead7d'
const ocaccesskey = '9f2e41d5-3c41-43bc-9376-ad390fe352f4'

// Global variable storing whether or not a first search has been conducted after page load
let firstSearchCompleted = false

// Global variable storing whether or not a new search has been initiated
let newSearchInitiated = false

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
let searchRadius = 5
let connectionType = "all"


////
/* DOMContentLoaded & NON-ITERATED EVENT LISTENERS */
////

// When DOM is loaded, adds event listener for search radius selector, connection type selector, adds current location button event listener,
// adds submit form event listener
document.addEventListener('DOMContentLoaded', event => {
    document.querySelector('#searchRadius').addEventListener('change', event => changeSearchRadius(event))
    document.querySelector('#connectionType').addEventListener('change', event => changeConnectionType(event))
    document.querySelector('#currentLocationButton').addEventListener('click', event => {
        newSearchInitiated = true
        getCoordinatesFromBrowser()
    })
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

// Called as a callback when new search radius selected. Sets search radius variable to user selected value, removes every displayed result station, 
// calls renderResults() to rerender result stations within the search radius
function changeSearchRadius(event) {
    searchRadius = parseInt(event.target.value, 10)
    stationArray.forEach(station => removeResults(station))
    renderResults()
}

// Called as a callback when new connection type selected. Sets connection type variable to user selected value, removes every displayed result station, 
// calls renderResults() to rerender result stations with a matching connection type
function changeConnectionType(event) {
    connectionType = event.target.value
    stationArray.forEach(station => removeResults(station))
    renderResults()
}

// Called as a callback when submit button is clicked. Prevents default page reload. If not first search after page load, removes every displayed result statiion,
// hides resultsContainer. Displays loader, sets newSearchInitiated to true, converts inputs into an address string, resets form, passes the string to getCoordinates
function submitForm(event) {
    event.preventDefault()
    if (firstSearchCompleted) {
        stationArray.forEach(station => removeResults(station))
        document.getElementById("resultsContainer").style.visibility = "hidden";
    }
    document.querySelector(".loader").style.display = "block";
    newSearchInitiated = true
    addressString = `${(event.target[0].value ? `${event.target[0].value}, ` : "" )}${(event.target[1].value ? `${event.target[1].value}, ` : "" )}${(event.target[2].value ? `${event.target[2].value} ` : "")}${(event.target[3].value ? `${event.target[3].value} ` : "")}${(event.target[4].value ? `${event.target[4].value}` : "")}`
    event.target.reset()
    getCoordinatesFromAddress(addressString)
}


////
/* API FUNCTIONS */
////

// Takes in coordinate string, sends GET request to position stack API to get address, parses server response and extracts relevant data to construct 
// an addressString. If promise returns an error, hides loader and displays error alert 
function getAddressFromCoordinates(coordinateString) {
    fetch(`http://api.positionstack.com/v1/reverse?access_key=${psaccesskey}&query=${coordinateString}&limit=1`)
    .then(resp => resp.json())
    .then(coordData => {
        addressString = `${coordData.data[0].name}, ${coordData.data[0].locality}, ${coordData.data[0].region_code} ${(coordData.data[0].postal_code ? coordData.data[0].postal_code.toString().slice(0, 5) : "")} ${coordData.data[0].country_code}`
    })
    .catch(error => {
        document.querySelector(".loader").style.display = "none";
        alert("There has been a problem communicating with the server. Please refresh the page and try again.")
    })
}

// Takes in address string from submitForm and initiates a GET request to position stack API, parses server response and extracts latitute and longitude
// values which are stored in searchLat & searchLong global variables, calls getChargePoints. If promise returns an error, hides loader and displays error 
// alert 
function getCoordinatesFromAddress(addressString) {
    fetch(`http://api.positionstack.com/v1/forward?access_key=${psaccesskey}&query=${addressString}&limit=1`)
    .then(resp => resp.json())
    .then(coordData => {
        searchLat = parseFloat(coordData.data[0].latitude)
        searchLong = parseFloat(coordData.data[0].longitude)
        getChargePoints()
    })
    .catch(error => {
        document.querySelector(".loader").style.display = "none";
        alert("There has been a problem communicating with the server. Please refresh the page and try again.")
    })
}

// Gets user's lat & long coordinates from the browser if possible and assigns to searchLat & searchLong or directionsLat & directionsLong variables 
// respectively, opens new google maps directions browser tab if !newSearchInitiated, otherwise calls getAddressFromCoordinates() and getChargePoints(). If the 
// browser request for geolocation is denied, browser will display error message in an alert.
function getCoordinatesFromBrowser(addressInfo) {
    if (!newSearchInitiated) {
        navigator.geolocation.getCurrentPosition(function(position) {
            directionsLat = parseFloat(position.coords.latitude)
            directionsLong = parseFloat(position.coords.longitude)
            window.open(`https://www.google.com/maps/dir/?api=1&origin=${directionsLat},${directionsLong}&destination=${addressInfo.Latitude},${addressInfo.Longitude}`, '_blank')
        }, function(error) {
            alert(`${error.message}. Have fun walking...`)
        })
    } else {
        navigator.geolocation.getCurrentPosition(function(position) {
            if (firstSearchCompleted) {
                stationArray.forEach(station => removeResults(station))
                document.getElementById("resultsContainer").style.visibility = "hidden";
            }
            document.querySelector(".loader").style.display = "block";
            searchLat = parseFloat(position.coords.latitude)
            searchLong = parseFloat(position.coords.longitude)
            getAddressFromCoordinates(`${searchLat},${searchLong}`)
            getChargePoints()
        }, function(error) {
            alert(`${error.message}. Have fun walking...`)
        })
    }
}

// Constructs GET payload, specifying JSON content type, initiates GET request to open charge map API with searchLat & searchLong query arguemnts,
// parses server response. If not the first search after page load (!firstSearchCompleted), calls removeResults and resets station array. Upon
// successful server response, parses response and extracts relevant data for each charge station. Each charge station object is pushed into 
// stationArray. Finally, renderResults is called. If promise returns an error, hides loader and displays error alert 
function getChargePoints() {
    const getObj = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    fetch(`https://api.openchargemap.io/v3/poi?latitude=${searchLat}&longitude=${searchLong}&distance=50&key=${ocaccesskey}`, getObj)
    .then(resp => resp.json())
    .then(data => {
        if (firstSearchCompleted) {
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
        renderResults()
    })
    .catch(error => {
        document.querySelector(".loader").style.display = "none";
        alert("There has been a problem communicating with the server. Please refresh the page and try again.")
    })
}


////
/* DOM FUNCTIONS*/
////

// Takes in a station object from stationArray. If the station is currently being displayed, removes result display from DOM and removes 
// DOM element key-value pair from stationArray
function removeResults(station) {
    if (station.resultElement) {
         document.getElementById("resultDisplay").removeChild(station.resultElement)
         delete station.resultElement
    }
}  

// Creates div containers, calls initializeRender() to prepare result display area, calls renderAddressP() to render search address string 
// to DOM. For each charge station in stationArray, extracts address info & connections info, calls renderStationResult() to render the station's
// result block to DOM. Calls renderNoResults(), sets firstSearchCompleted to true and newSearchInitiated to false, b/c the current search has 
// been completed
function renderResults() {
    const resultsContainer = document.getElementById("resultsContainer")
    const resultDisplay = document.querySelector("#resultDisplay")
    initializeRender(resultsContainer, resultDisplay)
    renderAddressP()
    stationArray.forEach(station => {
        const addressInfo = station.addressInfo
        const connectionsInfo = station.connections
        renderStationResult(station, addressInfo, connectionsInfo, resultDisplay)
    })
    renderNoResults(resultDisplay)
    firstSearchCompleted = true
    newSearchInitiated = false
}

// Takes in result display containers. If not first search after page load (firstSearchCompleted), removes the old search address string rendered to DOM
// so it can be replaced by new search address string. If the noResults h3 is being displayed, removes it from DOM. If first render after new seach has 
// been initiated (newSearchInitiated) resets search radius and connection type selectors to default selection and resets corresponding global variables
// to default values. Finally, hides the loader and makes the results display container visible
function initializeRender(resultsContainer, resultDisplay) {
    if (firstSearchCompleted) {
        document.querySelector('#addressContainer').removeChild(document.querySelector('#addressContainer p'))
    }
    if (document.querySelector(".noResults")) {
        resultDisplay.removeChild(document.querySelector(".noResults"))
    }
    if (newSearchInitiated) {
        document.getElementById('searchRadius').selectedIndex = 1
        document.getElementById('connectionType').selectedIndex = 0
        searchRadius = 5
        connectionType = "all"
    }
    document.querySelector(".loader").style.display = "none";
    resultsContainer.style.visibility = "visible"
}

// Creates a "p" element, sets its inner text equal to search address string, adds a class fro styling in CSS, renders the "p" to the DOM
function renderAddressP() {
    const addressP = document.createElement('p')
    addressP.innerText = addressString
    addressP.id = "addressP"
    document.querySelector('#addressContainer').appendChild(addressP)
}

// Takes in a staion, its associated addressInfo & connectionsInfo, and the result display "div" element. Performs checks to render only stations that
// match search criteria (search radius, connection type). If station matches criteria, constructs nested "div" elements for storing station information,
// Get Directions button & connection type image. Appends the information elements to the DOM via the return values of their constructor functions, adds
// resultElement key to the station and stores the station's result block there (n.b. the station is passed by reference from stationArray, so adding, the
// key value pair to the station also adds it in the stationArray global variable)
function renderStationResult(station, addressInfo, connectionsInfo, resultDisplay) {
    if (addressInfo.Distance <= searchRadius && !(connectionsInfo.length === 0)) {
        let chademo = false
        if (connectionsInfo.find(connection => connection.ConnectionType.FormalName && connection.ConnectionType.FormalName.includes("Configuration AA")) && connectionType === "CHAdeMO") {
            chademo = true
        }
        if (connectionType === "all" || ((connectionsInfo.find(connection => connection.ConnectionType.FormalName && connection.ConnectionType.FormalName.includes(connectionType)) || chademo))) {
            const resultBlock = document.createElement("div")
            resultBlock.className = "resultBlock"
            const resultDiv = document.createElement("div")
            resultDiv.className = "resultDiv"
            const row1Div = document.createElement('div')
            row1Div.className = "row1Div"
            row1Div.appendChild(renderResultTitleAddress(addressInfo))
            row1Div.appendChild(renderDirectionsButton(addressInfo))
            resultDiv.appendChild(row1Div)
            resultDiv.appendChild(renderConnectionsTitle())
            resultDiv.appendChild(renderConnections(station))
            resultBlock.appendChild(resultDiv)
            resultDisplay.appendChild(resultBlock)
            station.resultElement = resultBlock
        }
    }
}

// Creates a "div" to contain the elements displaying station's title, address, and distance from user. Creates those elements and usses information
// extracted from addressInfo for innerText values. Returns the container "div" to renderStationResult to be rendered to the DOM
function renderResultTitleAddress(addressInfo) {
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

// Creates the Get Directions div & button and adds a click event listener to the button. Sets button text value and appends the button to its container.
// The container is returned to renderStationResult to be rendered to the DOM
function renderDirectionsButton(addressInfo) {
    const directionsButtonDiv = document.createElement('div')
    directionsButtonDiv.className = "directionsButtonDiv"
    const directionsButton = document.createElement('button')
    directionsButton.className = "btn btn-md btn-default button"
    directionsButton.classList.add("directionsButton")
    directionsButton.addEventListener('click', event => {
        newSearchInitiated = false
        getCoordinatesFromBrowser(addressInfo)
    })
    directionsButton.innerText = "Get Directions"
    directionsButtonDiv.appendChild(directionsButton)
    return directionsButtonDiv
}

// Creates an "h5" element to display the "Connections:" header in the result block. Adds a class for CSS styling and returns the "h5" to
// renderStationResult to be rendered to the DOM
function renderConnectionsTitle() {
    const connectionsTitle = document.createElement('h5')
    connectionsTitle.innerText = "Connections:"
    connectionsTitle.className = "connectionsTitle"
    return connectionsTitle
}

// Takes in a chage station. Creates a "div" containing the station's connection information. For each connection creates a "div", adds a class
// for styling in CSS, calls renderConnectionImage & renderConnectionDetails to append connection info to the "div". Returns the "div" to 
// renderStationResult to be rendered to the DOM
function renderConnections(station) {
    const connectionsInfoContainer = document.createElement('div')
    connectionsInfoContainer.className = "connectionsInfoContainer"
    station.connections.forEach(connection => {
        const connectionDiv = document.createElement('div')
        connectionDiv.className = "connectionDiv"
        renderConnectionImage(connection, connectionDiv)
        renderConnectionDetails(connection, connectionDiv)
        connectionsInfoContainer.appendChild(connectionDiv)
    })
    return connectionsInfoContainer
}

// Takes in a station connection object and the associated "div", creates an img element, sets image src via getImage() and appends the image to the div
function renderConnectionImage(connection, connectionDiv) {
    const ctimg = document.createElement('img')
    ctimg.className = "ctimg"
    if (connection.ConnectionType.FormalName && (!connection.ConnectionType.FormalName.includes("Small Paddle") && !connection.ConnectionType.FormalName.includes("Not Specified"))) {
        ctimg.src = getImage(connection.ConnectionType.FormalName)
    } else {
        ctimg.src = getImage("")
    }
    connectionDiv.appendChild(ctimg)
}

// Takes in the connector type string and returns the appropraite connector image path
function getImage(imageString) {
    if (imageString.includes("J1772")) {
        return "./assets/Type1_J1772.png"
    } else if (imageString.includes("Configuration EE")) {
        return "./assets/CCS1.png"
    } else if (imageString.includes("Tesla")) {
        return "./assets/tesla.png"
    } else if (imageString.includes("CHAdeMO") || (imageString.includes("Configuration AA"))) {
        return "./assets/CHAdeMO.png"
    } else {
        return "./assets/question_mark.png"
    }
}

// Takes in a statino connection and the assoociated "div", creates a "ul" element fr storing connection info, creates "li" elements for connection type
// charge rate, current, and Amps/Volts values. Appends "li"'s to the "ul" and appends the "ul" to the "div"
function renderConnectionDetails(connection, connectionDiv) {
    const ul = document.createElement('ul')
        ul.className = "connectionList"
        const connectionType = document.createElement('li')
        connectionType.innerText = `${((connection.ConnectionType.FormalName && !connection.ConnectionType.FormalName.includes("Not Specified")) ? connection.ConnectionType.FormalName : "Unknown Type")}`
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
        connectionDiv.appendChild(ul)
}

// Takes in the result display "div", checks if any station result blocks have been rendered, if not (!stationArray.find(station => station.resultElement)),
// creates and "h3" element to inform the user that no charging stations were found and appends it to the result display "div" to render it to the DOM
function renderNoResults(resultDisplay) {
    if (!stationArray.find(station => station.resultElement)) {
        const noResults = document.createElement('h3')
        noResults.className = "noResults"
        noResults.innerText = "No charging stations found..."
        resultDisplay.appendChild(noResults)
    }
}