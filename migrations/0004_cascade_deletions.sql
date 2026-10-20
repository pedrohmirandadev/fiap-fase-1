-- Cada comando DELETE remove os dependentes na mesma transação do registro pai.
-- A referência opcional à OS é limpa sem apagar o histórico de estoque da peça.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '0004_cascade_deletions') THEN
    ALTER TABLE vehicles DROP CONSTRAINT vehicles_customer_id_fkey;
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

    ALTER TABLE work_orders DROP CONSTRAINT work_orders_customer_id_fkey;
    ALTER TABLE work_orders ADD CONSTRAINT work_orders_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

    ALTER TABLE work_orders DROP CONSTRAINT work_orders_vehicle_id_fkey;
    ALTER TABLE work_orders ADD CONSTRAINT work_orders_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

    ALTER TABLE inventory_movements DROP CONSTRAINT inventory_movements_work_order_id_fkey;
    ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_work_order_id_fkey
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL;

    -- PostgreSQL não cria índices nas colunas que referenciam uma FK.
    CREATE INDEX IF NOT EXISTS vehicles_customer_id_idx ON vehicles (customer_id);
    CREATE INDEX IF NOT EXISTS work_orders_customer_id_idx ON work_orders (customer_id);
    CREATE INDEX IF NOT EXISTS work_orders_vehicle_id_idx ON work_orders (vehicle_id);
    CREATE INDEX IF NOT EXISTS order_items_work_order_id_idx ON order_items (work_order_id);
    CREATE INDEX IF NOT EXISTS order_items_service_id_idx ON order_items (service_id);
    CREATE INDEX IF NOT EXISTS order_items_part_id_idx ON order_items (part_id);
    CREATE INDEX IF NOT EXISTS status_history_work_order_id_idx ON status_history (work_order_id);
    CREATE INDEX IF NOT EXISTS quote_decisions_work_order_id_idx ON quote_decisions (work_order_id);
    CREATE INDEX IF NOT EXISTS inventory_movements_part_id_idx ON inventory_movements (part_id);
    CREATE INDEX IF NOT EXISTS inventory_movements_work_order_id_idx ON inventory_movements (work_order_id);

    INSERT INTO schema_migrations (name) VALUES ('0004_cascade_deletions');
  END IF;
END $$;
