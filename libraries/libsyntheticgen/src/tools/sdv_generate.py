#!/usr/bin/env python3
"""Bridge between fit-terrain and SDV."""
import json
import sys
import pandas as pd
from sdv.metadata import Metadata
from sdv.single_table import GaussianCopulaSynthesizer


def main():
    config = json.load(open(sys.argv[1]))
    metadata = Metadata.load_from_json(config["metadata"])
    seed = config.get("seed", 0)

    for table_name in metadata.get_tables():
        data = pd.read_csv(config["data"][table_name])
        synth = GaussianCopulaSynthesizer(metadata, table_name=table_name)
        synth.fit(data)
        samples = synth.sample(num_rows=config["rows"], seed=seed)

        output = {
            "name": table_name,
            "records": json.loads(samples.to_json(orient="records")),
        }
        print(json.dumps(output))


if __name__ == "__main__":
    main()
