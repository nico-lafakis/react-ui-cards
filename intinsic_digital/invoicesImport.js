const axios = require('axios');

// Replace with your HubSpot Private App Access Token
const ACCESS_TOKEN = 'HUBSPOT_PRIVATE_ACCESS_TOKEN';

// The API endpoint for searching invoices
const url = 'https://api.hubapi.com/crm/v3/objects/invoices/search';

// The headers for the request, including the access token
const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
};

// The properties to retrieve for each invoice
const propertiesToFetch = [
    "hs_object_id",
    "location_id",
    "hs_number",
    "hs_invoice_status",
    "hs_createdate",
    "hs_amount_billed",
    "hs_due_date",
    "hs_balance_due"
];

// The request body, including the filter for 'location_id' and properties
const data = {
  filterGroups: [
    {
      filters: [
        {
          propertyName: "location_id",
          operator: "EQ",
          value: "ZRSVSH"
        }
      ]
    }
  ],
  properties: propertiesToFetch,
  limit: 100 // You can adjust the limit as needed, the max is 100 per request
};

// An async function to make the API call
const getInvoices = async () => {
    try {
        const response = await axios.post(url, data, { headers });
        const invoices = response.data.results || [];

        if (invoices.length > 0) {
            // Print the header row
            console.log(propertiesToFetch.join(','));
            
            // Print each invoice's properties in a comma-separated format
            invoices.forEach(invoice => {
                const properties = invoice.properties || {};
                const row = propertiesToFetch.map(prop => properties[prop] || '');
                console.log(row.join(','));
            });
        } else {
            console.log("No invoices found with the specified location_id.");
        }
    } catch (error) {
        console.error(`Error: ${error.response ? error.response.status : error.message}`);
        console.error(error.response ? error.response.data : 'An unknown error occurred');
    }
};

// Run the function
getInvoices();