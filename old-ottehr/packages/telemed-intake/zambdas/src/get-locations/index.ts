import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, ZambdaInput, createFhirClient } from 'ottehr-utils';
import { getM2MClientToken } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { Location, Practitioner } from 'fhir/r4';
import { SearchParam } from '@zapehr/sdk';

export interface GetLocationsInput {
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getM2MClientToken(secrets);
    } else {
      console.log('already have token');
    }

    // const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    // const user = await appClient.getMe();
    // console.log(user);

    const fhirClient = createFhirClient(zapehrToken);

    const getLocations = async (): Promise<Location[]> => {
      try {
        const searchParams: SearchParam[] = [{ name: 'status', value: 'active' }];
        const availableLocations: any[] = await fhirClient?.searchResources({
          resourceType: 'Location',
          searchParams: searchParams,
        });
        return availableLocations;
      } catch (error) {
        console.error('Failed to fetch locations:', error);
        return [];
      }
    };

    const locations = await getLocations();

    return {
      statusCode: 200,
      body: JSON.stringify(locations),
    };
  } catch (error: any) {
    console.log(error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};
