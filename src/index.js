const psaccesskey = '2924b2440dcf51f5ba91437412fead7d'
const ocaccesskey = '9f2e41d5-3c41-43bc-9376-ad390fe352f4'
let sourceLat
let sourceLong
let stationArray = []

document.addEventListener('DOMContentLoaded', event => {
    const form = document.querySelector('form')
    form.addEventListener('submit', event => submitForm(event))
})

function submitForm(event) {
    event.preventDefault()
    const addressString = `${event.target[0].value}, ${event.target[1].value}, ${event.target[2].value} ${event.target[3].value} ${event.target[4].value}`
    event.target.reset()
    getCoordinates(addressString)
}

function getCoordinates(addressString) {
    fetch(`http://api.positionstack.com/v1/forward?access_key=${psaccesskey}&query=${addressString}&limit=1`)
    .then(resp => resp.json())
    .then(coordData => {
        sourceLat = parseFloat(coordData.data[0].latitude)
        sourceLong = parseFloat(coordData.data[0].longitude)
        getChargePoints()
    })
}

function getChargePoints() {
    const getObj = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    fetch(`https://api.openchargemap.io/v3/poi?latitude=${sourceLat}&longitude=${sourceLong}&distance=1.5&key=${ocaccesskey}`, getObj)
    .then(resp => resp.json())
    .then(data => {
        data.forEach(station => stationArray.push({
            stationID: station.ID,
            stationUID: station.UUID,
            dataQuality: station.DataQualityLevel,
            status: station.statusType,
            lastStatusUpdate: station.DateLastStatusUpdate,
            usageCost: station.UsageCost,
            addressInfo: station.AddressInfo
        }))
        console.log(stationArray)
        renderResults()
    })
}

function renderResults() {
    stationArray.forEach(station => {
        const addressInfo = station.addressInfo
        const resultDiv = document.createElement("div")
        const stationTitle = document.createElement("h3")
        stationTitle.innerText = addressInfo.Title
        resultDiv.appendChild(stationTitle)
        const stationAddress = document.createElement("p")
        stationAddress.innerText = `${addressInfo.AddressLine1}, ${addressInfo.Town}, ${addressInfo.StateOrProvince} ${addressInfo.Postcode} ${addressInfo.Country.ISOCode}`
        resultDiv.appendChild(stationAddress)
        document.getElementById("resultsContainer").appendChild(resultDiv)
    });
}