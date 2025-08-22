import React, { useEffect, useState } from 'react';
import {
  hubspot,
  LoadingSpinner,
  Text,
  Button,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell
} from '@hubspot/ui-extensions';

const Extension = ({ context, runServerlessFunction }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const objectId = context.crm.objectId;

  const loadInvoices = () => {
    setLoading(true);
    setError(null);

    runServerlessFunction({
      name: 'getInvoices',
      parameters: { objectId }
    })
      .then(response => {
        console.log('Response:', response);
        
        // Handle HubSpot serverless function response format
        if (response && response.status === 'SUCCESS' && response.response) {
          // response.response might already be an object, not a string
          let parsedResponse;
          if (typeof response.response === 'string') {
            parsedResponse = JSON.parse(response.response);
          } else {
            parsedResponse = response.response;
          }
          
          if (parsedResponse.body && parsedResponse.body.results) {
            setInvoices(parsedResponse.body.results);
          } else {
            setError('No invoice data found');
          }
        } else {
          setError('Unexpected response format');
        }
      })
      .catch(err => {
        console.error('Error:', err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading invoices..." />;
  }

  if (error) {
    return (
      <>
        <Text>Error: {error}</Text>
        <Button onClick={loadInvoices}>Retry</Button>
      </>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <>
        <Text>No invoices found</Text>
        <Button onClick={loadInvoices}>Refresh</Button>
      </>
    );
  }

  return (
    <>
      <Text>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} found</Text>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Invoice #</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Amount</TableHeader>
            <TableHeader>Balance</TableHeader>
            <TableHeader>Due Date</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <Text>{invoice.invoiceNumber}</Text>
              </TableCell>
              <TableCell>
                <Text>{invoice.status}</Text>
              </TableCell>
              <TableCell>
                <Text>${invoice.amountBilled}</Text>
              </TableCell>
              <TableCell>
                <Text>${invoice.balance}</Text>
              </TableCell>
              <TableCell>
                <Text>{new Date(invoice.dueDate).toLocaleDateString()}</Text>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={loadInvoices}>Refresh</Button>
    </>
  );
};

hubspot.extend(({ context, runServerlessFunction }) => (
  <Extension context={context} runServerlessFunction={runServerlessFunction} />
));