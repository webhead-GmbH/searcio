// Webhead scaffold managed file. scaffold:update may refresh this file.
//
// DataViews with the stylesheets it needs. Import the table from here, never
// from the package:
//
//     import { DataViews } from '../../components/DataViews';
//
// `@wordpress/dataviews` ships its styles as a separate file, and a table
// rendered without them still renders. It is as wide as its content and not as
// its container, its headers are centred, and nothing reports a stylesheet
// that is missing. The settings screen used to be the only one that imported
// it, so a table on any other screen came out that way.
import './Default/dataviews.css';
import './dataviews.scss';

export * from '@wordpress/dataviews';
