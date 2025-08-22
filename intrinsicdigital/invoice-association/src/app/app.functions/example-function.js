const hubspot = require('@hubspot/api-client');

exports.main = async (context = {}) => {
  const { hs_object_id } = context.propertiesToSend;
  const hubspotClient = new hubspot.Client({
    accessToken: process.env.PRIVATE_APP_ACCESS_TOKEN
  });

  try {
    // 1. Get the Conference object's invoice_id
    const conference = await hubspotClient.crm.objects.basicApi.getById(
      '2-20107961',
      hs_object_id,
      ['invoice_id']
    );

    const invoiceId = conference.properties.invoice_id;
    
    if (!invoiceId) {
      return { invoice: null };
    }

    // 2. Search for Invoice object with matching invoice_id
    const searchRequest = {
      filterGroups: [{
        filters: [{
          propertyName: 'invoice_id',
          operator: 'EQ',
          value: invoiceId
        }]
      }],
      properties: [
        'hs_number',
        'hs_invoice_status',
        'hs_invoice_date',
        'hs_amount_billed',
        'hs_amount_paid'
      ],
      limit: 1
    };

    const searchResults = await hubspotClient.crm.objects.searchApi.doSearch(
      '0-53', // Invoice object type ID
      searchRequest
    );

    if (searchResults.results.length > 0) {
      const invoice = searchResults.results[0];
      return {
        invoice: {
          id: invoice.id,
          ...invoice.properties
        }
      };
    }

    return {
      invoice: null
    };
  } catch (error) {
    console.error('Error finding invoice:', error);
    throw new Error('Failed to find invoice');
  }
};