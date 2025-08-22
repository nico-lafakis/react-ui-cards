const hubspot = require('@hubspot/api-client');

exports.main = async (context = {}) => {
  console.log('Serverless function "getInvoices" starting.');
  console.log('Context received:', JSON.stringify(context, null, 2));

  try {
    const parameters = context.parameters || {};
    console.log('Parameters:', JSON.stringify(parameters, null, 2));

    const objectId = parameters.objectId;
    console.log('Resolved objectId:', objectId);
    if (!objectId) {
      console.warn('No object ID provided. Aborting.');
      return { body: { status: 'error', message: 'No object ID was provided.' } };
    }

    // Use your Private App token here
    const privateAppToken = 'HUBSPOT_PRIVATE_ACCESS_TOKEN';
    console.log('Initializing HubSpot client with Private App token.');
    const hubspotClient = new hubspot.Client({ accessToken: privateAppToken });

    console.log(`Fetching p_properties/${objectId}...`);
    const recordResponse = await hubspotClient.crm.objects.basicApi.getById(
      'p_properties',
      objectId,
      ['location_id']
    );
    console.log('Record response:', JSON.stringify(recordResponse, null, 2));

    const locationId = recordResponse.properties?.location_id;
    console.log('Extracted location_id:', locationId);
    if (!locationId) {
      console.warn('No location_id on property record.');
      return { body: { status: 'error', message: 'Property record missing location_id.' } };
    }

    const searchRequest = {
      filterGroups: [{ filters: [{ propertyName: 'location_id', operator: 'EQ', value: locationId }] }],
      properties: ["hs_number","hs_invoice_status","hs_createdate","hs_amount_billed","hs_due_date","hs_balance_due"],
      limit: 100,
      sorts: [{ propertyName: 'hs_createdate', direction: 'DESCENDING' }]
    };
    console.log('Invoice search payload:', JSON.stringify(searchRequest, null, 2));

    let apiResponse;
    try {
      console.log('Searching "invoices"...');
      apiResponse = await hubspotClient.crm.objects.searchApi.doSearch('invoices', searchRequest);
    } catch (err) {
      console.warn(`Search "invoices" failed (${err.message}), falling back to "invoice".`);
      apiResponse = await hubspotClient.crm.objects.searchApi.doSearch('invoice', searchRequest);
    }
    console.log('Search response:', JSON.stringify(apiResponse, null, 2));

    const total = apiResponse.total || apiResponse.results?.length || 0;
    console.log(`Found ${total} invoice(s).`);

    const results = (apiResponse.results || []).map(inv => ({
      id: inv.id,
      invoiceNumber: inv.properties.hs_number,
      status: inv.properties.hs_invoice_status,
      createDate: inv.properties.hs_createdate,
      amountBilled: inv.properties.hs_amount_billed,
      dueDate: inv.properties.hs_due_date,
      balance: inv.properties.hs_balance_due
    }));
    console.log('Formatted results:', JSON.stringify(results, null, 2));

    return { body: { status: 'success', total, results } };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { body: { status: 'error', message: error.message } };
  }
};
