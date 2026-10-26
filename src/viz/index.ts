import type { ComponentType } from 'react';
import DataSystemFlow from './DataSystemFlow';
import FanoutSim from './FanoutSim';
import GraphQuery from './GraphQuery';
import MttfCalc from './MttfCalc';
import NormalizationSim from './NormalizationSim';
import PercentileSim from './PercentileSim';
import ResumeModel from './ResumeModel';
import HashIndexSim from './HashIndexSim';
import LSMTreeSim from './LSMTreeSim';
import BTreeSim from './BTreeSim';
import ColumnStoreViz from './ColumnStoreViz';
import DataCubeViz from './DataCubeViz';
import EncodingBytes from './EncodingBytes';
import SchemaResolver from './SchemaResolver';
import RollingUpgradeSim from './RollingUpgradeSim';
import ReplicationSim from './ReplicationSim';
import FailoverSim from './FailoverSim';
import LagAnomalySim from './LagAnomalySim';
import ConflictSim from './ConflictSim';
import TopologySim from './TopologySim';
import QuorumSim from './QuorumSim';
import CartVersionSim from './CartVersionSim';
import PartitionSim from './PartitionSim';
import SecondaryIndexSim from './SecondaryIndexSim';
import RebalanceSim from './RebalanceSim';
import RoutingSim from './RoutingSim';
import TxnSim from './TxnSim';
import MVCCViz from './MVCCViz';

/** Registry of interactive visualizations, referenced from lessons as `:::visual Name | Title`. */
export const VIZ: Record<string, ComponentType<any>> = {
  // Chapter 1
  DataSystemFlow,
  MttfCalc,
  FanoutSim,
  PercentileSim,
  // Chapter 2
  ResumeModel,
  NormalizationSim,
  GraphQuery,
  // Chapter 3
  HashIndexSim,
  LSMTreeSim,
  BTreeSim,
  ColumnStoreViz,
  DataCubeViz,
  // Chapter 4
  EncodingBytes,
  SchemaResolver,
  RollingUpgradeSim,
  // Chapter 5
  ReplicationSim,
  FailoverSim,
  LagAnomalySim,
  ConflictSim,
  TopologySim,
  QuorumSim,
  CartVersionSim,
  // Chapter 6
  PartitionSim,
  SecondaryIndexSim,
  RebalanceSim,
  RoutingSim,
  // Chapter 7
  TxnSim,
  MVCCViz,
};
