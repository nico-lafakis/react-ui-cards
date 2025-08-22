import React, { useState, useEffect } from "react";
import {
  Text,
  LoadingSpinner,
  ErrorState,
  Divider,
  Flex,
  Link,
  hubspot,
} from "@hubspot/ui-extensions";

hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <InvoicePreview
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

const InvoicePreview = ({ context, runServerless, sendAlert }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    const fetchInvoiceData = async () => {
      try {
        const { response } = await runServerless({
          name: "getAssociatedInvoice",
          propertiesToSend: ["hs_object_id"],
        });
        
        if (response.invoice) {
          setInvoice(response.invoice);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceData();
  }, [runServerless]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorState title="Error loading invoice data">{error}</ErrorState>;
  }

  if (!invoice) {
    return (
      <Text>
        No associated invoice found for this conference.
      </Text>
    );
  }

  return (
    <Flex direction="column" gap="md">
      <Text>
        <Text format={{ fontWeight: "bold" }}>Invoice Details</Text>
      </Text>
      
      <Divider />
      
      <Flex direction="row" justify="between">
        <Text>Invoice Number:</Text>
        <Text>{invoice.hs_number || 'N/A'}</Text>
      </Flex>
      
      <Flex direction="row" justify="between">
        <Text>Status:</Text>
        <Text>{invoice.hs_invoice_status || 'N/A'}</Text>
      </Flex>
      
      <Flex direction="row" justify="between">
        <Text>Invoice Date:</Text>
        <Text>{invoice.hs_invoice_date ? new Date(invoice.hs_invoice_date).toLocaleDateString() : 'N/A'}</Text>
      </Flex>
      
      <Flex direction="row" justify="between">
        <Text>Amount Billed:</Text>
        <Text>{invoice.hs_amount_billed ? `$${invoice.hs_amount_billed}` : 'N/A'}</Text>
      </Flex>
      
      <Flex direction="row" justify="between">
        <Text>Amount Paid:</Text>
        <Text>{invoice.hs_amount_paid ? `$${invoice.hs_amount_paid}` : 'N/A'}</Text>
      </Flex>
      
      <Divider />
      
      {invoice.id && (
        <Link href={`/objects/0-53/${invoice.id}`}>
          View Invoice Details
        </Link>
      )}
    </Flex>
  );
};