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
import NetworkTimeoutSim from './NetworkTimeoutSim';
import ClockSkewLWW from './ClockSkewLWW';
import LeaseFencingSim from './LeaseFencingSim';
import LinearizabilityViz from './LinearizabilityViz';
import QuorumRaceSim from './QuorumRaceSim';
import CAPSim from './CAPSim';
import CausalityViz from './CausalityViz';
import TOBSim from './TOBSim';
import TwoPCSim from './TwoPCSim';
import RaftSim from './RaftSim';
import PipelineViz from './PipelineViz';
import MapReduceViz from './MapReduceViz';
import JoinViz from './JoinViz';
import BatchFaultsViz from './BatchFaultsViz';
import PregelViz from './PregelViz';
import BrokerSim from './BrokerSim';
import LogBrokerSim from './LogBrokerSim';
import DualWriteSim from './DualWriteSim';
import EventSourcingViz from './EventSourcingViz';
import StreamTimeViz from './StreamTimeViz';
import ExactlyOnceSim from './ExactlyOnceSim';

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
  // Chapter 8
  NetworkTimeoutSim,
  ClockSkewLWW,
  LeaseFencingSim,
  // Chapter 9
  LinearizabilityViz,
  QuorumRaceSim,
  CAPSim,
  CausalityViz,
  TOBSim,
  TwoPCSim,
  RaftSim,
  // Chapter 10
  PipelineViz,
  MapReduceViz,
  JoinViz,
  BatchFaultsViz,
  PregelViz,
  // Chapter 11
  BrokerSim,
  LogBrokerSim,
  DualWriteSim,
  EventSourcingViz,
  StreamTimeViz,
  ExactlyOnceSim,
};
